import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import type { DefinedSystem } from '@lingcootech/frame-extension-sdk';
import type { ExtensionEnvironmentSource } from '@lingcootech/frame-extension-sdk/environment';
import {
  assertSystemCompatibility,
  createNoopTelemetry,
  createSystemEnvironmentRegistry,
  createSystemServerCapabilityRegistry,
  frameKernelSystem,
  registerSystemServerExtensions,
  type DatabaseAdapter,
  type DatabaseConnection,
  type ServerCapabilityRegistry,
  type SystemEnvironmentRegistry,
  type TelemetryPort,
} from '@lingcootech/frame-kernel';
import {
  createDenyAllSecurityProvider,
  SECURITY_PROVIDER_CAPABILITY,
  type SecurityProvider,
} from './security.js';

export interface FastifyHostMetadata {
  appName?: string;
  appVersion?: string;
  environment?: string;
}

export interface FastifyDatabaseOptions<TDatabase = unknown> {
  adapter: DatabaseAdapter<TDatabase>;
  connectionString: string;
}

export interface BuildFastifyHostOptions<TDatabase = unknown> {
  system?: DefinedSystem;
  metadata?: FastifyHostMetadata;
  database?: FastifyDatabaseOptions<TDatabase>;
  telemetry?: TelemetryPort;
  environmentSource?: ExtensionEnvironmentSource;
  nodeEnv?: 'development' | 'test' | 'production';
  applicationEnvironment?: unknown;
  securityProvider?: SecurityProvider;
  shutdownTelemetryOnClose?: boolean;
  corsOrigin?: boolean | string | string[];
  rateLimitMax?: number;
  logger?: FastifyServerOptions['logger'];
}

export interface FrameFastifyContext<TDatabase = unknown> {
  readonly system: DefinedSystem;
  readonly database?: DatabaseConnection<TDatabase>;
  readonly telemetry: TelemetryPort;
  readonly capabilities: ServerCapabilityRegistry;
  readonly environment: SystemEnvironmentRegistry;
}

export type FrameFastifyInstance<TDatabase = unknown> = FastifyInstance & {
  frameKernel: FrameFastifyContext<TDatabase>;
};

function requestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate && /^[a-zA-Z0-9._:-]{8,120}$/.test(candidate) ? candidate : randomUUID();
}

export async function buildFastifyHost<TDatabase = unknown>(
  options: BuildFastifyHostOptions<TDatabase> = {},
): Promise<FrameFastifyInstance<TDatabase>> {
  const system = options.system ?? frameKernelSystem;
  assertSystemCompatibility(system);
  const telemetry = options.telemetry ?? createNoopTelemetry();
  const environment = createSystemEnvironmentRegistry({
    system,
    source: options.environmentSource,
    nodeEnv: options.nodeEnv,
  });
  const capabilityOverrides = new Map<string, unknown>();
  const declaresSecurityProvider = system.extensions.some((extension) =>
    extension.manifest.capabilities?.server?.provides?.some(
      (capability) => capability.id === SECURITY_PROVIDER_CAPABILITY,
    ),
  );
  if (options.securityProvider && declaresSecurityProvider) {
    capabilityOverrides.set(SECURITY_PROVIDER_CAPABILITY, options.securityProvider);
  }
  const capabilities = createSystemServerCapabilityRegistry(system, capabilityOverrides);
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: true,
    genReqId(request) {
      return requestId(request.headers['x-request-id']);
    },
  }) as unknown as FrameFastifyInstance<TDatabase>;
  let database: DatabaseConnection<TDatabase> | undefined;

  try {
    database = options.database
      ? await options.database.adapter.connect({
          connectionString: options.database.connectionString,
        })
      : undefined;
    app.decorate('frameKernel', { system, database, telemetry, capabilities, environment });
    app.addHook('onRequest', (_request, reply, done) => {
      reply.header('x-content-type-options', 'nosniff');
      reply.header('referrer-policy', 'strict-origin-when-cross-origin');
      done();
    });
    app.addHook('onClose', async () => {
      await database?.close();
      if (options.shutdownTelemetryOnClose) await telemetry.shutdown();
    });

    await app.register(sensible);
    await app.register(cors, { origin: options.corsOrigin ?? false });
    await app.register(helmet);
    const securityProvider =
      options.securityProvider ??
      capabilities.get<SecurityProvider>(SECURITY_PROVIDER_CAPABILITY) ??
      createDenyAllSecurityProvider();
    const security = await securityProvider.install({
      app,
      env: options.applicationEnvironment,
      environment,
    });
    app.decorate('security', security);
    app.decorateRequest('principal', null);
    app.decorateRequest('auth', null);
    app.decorate('authenticate', async (request) => {
      const principal = await app.security.authenticate(request);
      request.principal = principal;
      request.auth = {
        accountId: principal.accountId ?? principal.subject,
        sessionId: principal.sessionId ?? '',
        email: principal.email ?? '',
        displayName: principal.displayName ?? principal.subject,
        roleCodes: principal.roleCodes,
        permissions: principal.permissions,
      };
    });
    app.decorate('requirePermission', (required: string | string[]) => {
      const permissions = Array.isArray(required) ? required : [required];
      return async (request) => {
        await app.authenticate(request);
        if (!request.principal || !(await app.security.authorize(request.principal, permissions))) {
          throw app.httpErrors.forbidden('当前账号没有执行此操作的权限');
        }
      };
    });
    await app.register(rateLimit, {
      max: options.rateLimitMax ?? 300,
      timeWindow: '1 minute',
    });

    app.get('/health', async () => ({
      status: 'ok',
      name: options.metadata?.appName ?? system.id,
      version: options.metadata?.appVersion ?? system.version,
      environment: options.metadata?.environment ?? 'unknown',
      uptime: Math.round(process.uptime()),
    }));
    app.get('/ready', async (_request, reply) => {
      if (!database) return { status: 'ready', database: 'not_configured' };
      try {
        await database.ping();
        return { status: 'ready', database: 'ok' };
      } catch (error) {
        telemetry.recordException(error, {
          component: 'readiness',
          adapter: options.database!.adapter.id,
        });
        return reply.code(503).send({ status: 'not_ready', database: 'unavailable' });
      }
    });

    app.setErrorHandler(async (error, request, reply) => {
      if (error instanceof ZodError) {
        return reply.code(400).send({
          error: 'ValidationError',
          message: '请求参数无效',
          details: error.flatten(),
        });
      }
      const normalized = error instanceof Error ? error : new Error('Internal Server Error');
      const statusCode =
        typeof (error as { statusCode?: unknown }).statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : 500;
      if (statusCode >= 500) {
        telemetry.recordException(error, {
          component: 'http',
          method: request.method,
          route: request.routeOptions.url || request.url.split('?')[0]!,
        });
      }
      request.log.error({ error, requestId: request.id }, 'request failed');
      return reply.code(statusCode).send({
        error: statusCode >= 500 ? 'InternalServerError' : normalized.name,
        message: statusCode >= 500 ? '服务器开小差了，请稍后再试' : normalized.message,
      });
    });

    await registerSystemServerExtensions(
      {
        app,
        hasRoute(method, path) {
          return app.hasRoute({ method, url: path });
        },
      },
      system,
    );
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}

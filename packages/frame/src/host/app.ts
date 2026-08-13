import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

import { createDatabase } from '@lingcootech/frame-database';
import type { DefinedSystem } from '@lingcootech/frame-extension-sdk';
import { frameKernelSystem } from '../kernel/system.js';
import {
  assertFrameSystemCompatibility,
  createSystemServerCapabilityRegistry,
  createSystemSettingsRegistry,
  registerSystemServerExtensions,
} from '../runtime/extensions.js';
import {
  createSystemEnvironmentRegistry,
  readSystemEnvironmentSensitiveValues,
} from '../runtime/environment.js';
import type { AppEnv } from './env.js';
import { serializeSafeError } from './logging.js';
import { registerOperationalRoutes } from './operational-routes.js';
import { runWithRequestContext, setRequestActor } from './request-context.js';
import {
  createDenyAllSecurityProvider,
  SECURITY_PROVIDER_CAPABILITY,
  type SecurityProvider,
} from './security.js';

function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export interface StaticAssetDirectories {
  adminDirectory?: string;
  publicDirectory?: string;
}

export interface BuildAppOptions {
  system?: DefinedSystem;
  staticAssets?: StaticAssetDirectories;
  securityProvider?: SecurityProvider;
}

export async function buildApp(env: AppEnv, options: BuildAppOptions = {}) {
  const system = options.system ?? frameKernelSystem;
  assertFrameSystemCompatibility(system);
  const environment = createSystemEnvironmentRegistry(system, env);
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
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers.set-cookie',
          '*.password',
          '*.secret',
          '*.token',
          '*.apiKey',
        ],
        censor: '[REDACTED]',
      },
    },
    genReqId(request) {
      const provided = request.headers['x-request-id'];
      const candidate = Array.isArray(provided) ? provided[0] : provided;
      return candidate && /^[a-zA-Z0-9._:-]{8,120}$/.test(candidate) ? candidate : randomUUID();
    },
    trustProxy: true,
  });
  const { db, pool } = createDatabase(env.DATABASE_URL);

  app.decorate('appEnv', env);
  app.decorate('frameSystem', system);
  app.decorate('capabilities', capabilities);
  app.decorate('environment', environment);
  app.decorate('db', db);
  app.decorate('settingsRegistry', createSystemSettingsRegistry(system));
  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    runWithRequestContext({ requestId: request.id }, done);
  });
  app.addHook('onClose', async () => {
    await pool.end();
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: parseCorsOrigins(env.CORS_ORIGIN),
    credentials: true,
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https:'],
      },
    },
  });
  const securityProvider =
    options.securityProvider ??
    capabilities.get<SecurityProvider>(SECURITY_PROVIDER_CAPABILITY) ??
    createDenyAllSecurityProvider();
  let security;
  try {
    security = await securityProvider.install({ app, env, environment });
  } catch (error) {
    await app.close();
    throw error;
  }
  app.decorate('security', security);
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  app.decorateRequest('auth', null);
  app.decorateRequest('principal', null);
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
    setRequestActor(principal.accountId ?? principal.subject);
  });
  app.decorate('requirePermission', (required: string | string[]) => {
    const permissionCodes = Array.isArray(required) ? required : [required];
    return async (request) => {
      await app.authenticate(request);
      if (
        !request.principal ||
        !(await app.security.authorize(request.principal, permissionCodes))
      ) {
        throw app.httpErrors.forbidden('当前账号没有执行此操作的权限');
      }
    };
  });

  registerOperationalRoutes(app);

  // Register the root error handler before extension plugins so their
  // encapsulated routes inherit the standard Frame error contract.
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
    const safeError = serializeSafeError(error, [
      ...(app.security.sensitiveValues ?? []),
      ...readSystemEnvironmentSensitiveValues(environment),
      env.SETTINGS_ENCRYPTION_KEY,
      env.METRICS_BEARER_TOKEN,
    ]);
    request.log.error(
      { errorName: safeError.name, errorMessage: safeError.message, requestId: request.id },
      'request failed',
    );
    if (statusCode >= 500 && app.hasDecorator('observability')) {
      await app.observability
        .captureRequestError({
          error,
          requestId: request.id,
          method: request.method,
          route: request.routeOptions.url || request.url.split('?')[0],
        })
        .catch(() => undefined);
    }
    return reply.code(statusCode).send({
      error: statusCode >= 500 ? 'InternalServerError' : normalized.name,
      message: statusCode >= 500 ? '服务器开小差了，请稍后再试' : normalized.message,
    });
  });

  try {
    await registerSystemServerExtensions(app, system);
  } catch (error) {
    await app.close();
    throw error;
  }

  const adminDist = options.staticAssets?.adminDirectory;
  const publicDist = options.staticAssets?.publicDirectory;

  if (adminDist && existsSync(adminDist)) {
    await app.register(fastifyStatic, {
      root: adminDist,
      prefix: '/admin/',
      decorateReply: false,
    });
  }
  if (publicDist && existsSync(publicDist)) {
    await app.register(fastifyStatic, {
      root: publicDist,
      prefix: '/',
    });
  }

  app.setNotFoundHandler(async (request, reply) => {
    // HEAD must resolve like GET so browsers, health probes, and link
    // previews that issue HEAD against SPA routes receive the page headers
    // instead of a 404 JSON body.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return reply.code(404).send({ error: 'NotFound', message: '接口不存在' });
    }
    if (request.url.startsWith('/api/') || request.url === '/health' || request.url === '/ready') {
      return reply.code(404).send({ error: 'NotFound', message: '接口不存在' });
    }
    if (request.url.startsWith('/admin') && adminDist && existsSync(adminDist)) {
      return reply.sendFile('index.html', adminDist);
    }
    const redirect = app.hasDecorator('publicSiteRegistry')
      ? await app.publicSiteRegistry.resolveRedirect(request.url.split('?')[0])
      : null;
    if (redirect) {
      return reply.code(redirect.statusCode).header('Location', redirect.targetPath).send();
    }
    if (publicDist && existsSync(publicDist)) {
      return reply.sendFile('index.html', publicDist);
    }
    return reply.code(404).send({ error: 'NotFound', message: '页面不存在' });
  });

  return app;
}

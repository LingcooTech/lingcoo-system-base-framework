import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';

import { createDatabase } from './db/client.js';
import type { AppEnv } from './lib/env.js';
import { hasAnyPermission, type PermissionCode } from './lib/rbac.js';
import { runWithRequestContext, setRequestActor } from './lib/request-context.js';
import { serializeSafeError } from './lib/structured-log.js';
import { appModules } from './modules/index.js';
import { AuthRepository } from './modules/auth/repository.js';
import { CmsService } from './modules/cms/service.js';
import { baseDatasetAdapters } from './modules/data-exchange/adapters.js';
import { DatasetRegistry } from './modules/data-exchange/registry.js';
import { installObservability } from './modules/observability/index.js';
import { MetricsRegistry } from './modules/observability/metrics.js';
import { ObservabilityService } from './modules/observability/service.js';
import { baseSearchProviders } from './modules/search/providers.js';
import { SearchProviderRegistry } from './modules/search/registry.js';

const sourceDirectory = path.dirname(fileURLToPath(import.meta.url));

function parseCorsOrigins(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function runtimePath(...segments: string[]): string {
  return path.resolve(sourceDirectory, '..', ...segments);
}

function resolveJwtSecret(env: AppEnv): string {
  if (env.AUTH_JWT_SECRET) return env.AUTH_JWT_SECRET;
  if (env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET is required in production');
  }
  return 'lingcoo-frame-development-jwt-secret-change-me';
}

export async function buildApp(env: AppEnv) {
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
  const cms = new CmsService(db);

  app.decorate('appEnv', env);
  app.decorate('db', db);
  const searchRegistry = new SearchProviderRegistry();
  for (const provider of baseSearchProviders) searchRegistry.register(provider);
  app.decorate('searchRegistry', searchRegistry);
  const datasetRegistry = new DatasetRegistry();
  for (const adapter of baseDatasetAdapters) datasetRegistry.register(adapter);
  app.decorate('datasetRegistry', datasetRegistry);
  app.decorate('observability', new ObservabilityService(db, new MetricsRegistry()));
  app.addHook('onRequest', (request, reply, done) => {
    reply.header('x-request-id', request.id);
    runWithRequestContext({ requestId: request.id }, done);
  });
  installObservability(app);
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
  await app.register(cookie);
  await app.register(jwt, {
    secret: resolveJwtSecret(env),
    cookie: {
      cookieName: env.AUTH_COOKIE_NAME,
      signed: false,
    },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  app.decorateRequest('auth', null);
  app.decorate('authenticate', async (request) => {
    try {
      await request.jwtVerify();
    } catch {
      throw app.httpErrors.unauthorized('登录已过期，请重新登录');
    }
    if (!request.user.sub || !request.user.sid) {
      throw app.httpErrors.unauthorized('登录凭证无效');
    }

    const repository = new AuthRepository(app.db);
    const resolved = await repository.resolveSession(request.user.sid, request.user.sub);
    if (!resolved) {
      throw app.httpErrors.unauthorized('登录已失效，请重新登录');
    }
    const access = await repository.getAccess(resolved.account.id);
    request.auth = {
      accountId: resolved.account.id,
      sessionId: resolved.session.id,
      email: resolved.account.email,
      displayName: resolved.account.displayName,
      roleCodes: access.roles.map((role) => role.code),
      permissions: access.permissions,
    };
    setRequestActor(resolved.account.id);
    await repository.touchSession(resolved.session.id, resolved.session.lastSeenAt);
  });
  app.decorate('requirePermission', (required: PermissionCode | PermissionCode[]) => {
    const permissionCodes = Array.isArray(required) ? required : [required];
    return async (request) => {
      await app.authenticate(request);
      if (
        !request.auth ||
        !hasAnyPermission(request.auth.roleCodes, request.auth.permissions, permissionCodes)
      ) {
        throw app.httpErrors.forbidden('当前账号没有执行此操作的权限');
      }
    };
  });

  for (const appModule of appModules) {
    await app.register(appModule.register);
  }

  const adminDist = runtimePath('admin-ui', 'dist');
  const publicDist = runtimePath('public-web', 'dist');

  if (existsSync(adminDist)) {
    await app.register(fastifyStatic, {
      root: adminDist,
      prefix: '/admin/',
      decorateReply: false,
    });
  }
  if (existsSync(publicDist)) {
    await app.register(fastifyStatic, {
      root: publicDist,
      prefix: '/',
    });
  }

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
      env.AUTH_JWT_SECRET,
      env.SETTINGS_ENCRYPTION_KEY,
      env.AUTH_BOOTSTRAP_PASSWORD,
      env.METRICS_BEARER_TOKEN,
    ]);
    request.log.error(
      { errorName: safeError.name, errorMessage: safeError.message, requestId: request.id },
      'request failed',
    );
    if (statusCode >= 500 && app.observability) {
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

  app.setNotFoundHandler(async (request, reply) => {
    if (request.method !== 'GET') {
      return reply.code(404).send({ error: 'NotFound', message: '接口不存在' });
    }
    if (request.url.startsWith('/api/') || request.url === '/health' || request.url === '/ready') {
      return reply.code(404).send({ error: 'NotFound', message: '接口不存在' });
    }
    if (request.url.startsWith('/admin') && existsSync(adminDist)) {
      return reply.sendFile('index.html', adminDist);
    }
    const redirect = await cms.resolveRedirect(request.url.split('?')[0]);
    if (redirect) {
      return reply.code(redirect.statusCode).header('Location', redirect.targetPath).send();
    }
    if (existsSync(publicDist)) {
      return reply.sendFile('index.html', publicDist);
    }
    return reply.code(404).send({ error: 'NotFound', message: '页面不存在' });
  });

  return app;
}

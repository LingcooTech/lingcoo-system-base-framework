import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';

import { createDatabase } from './db/client.js';
import type { AppEnv } from './lib/env.js';
import { appModules } from './modules/index.js';

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

export async function buildApp(env: AppEnv) {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
    trustProxy: true,
  });
  const { db, pool } = createDatabase(env.DATABASE_URL);

  app.decorate('appEnv', env);
  app.decorate('db', db);
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
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
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

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, 'request failed');
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
    return reply.code(statusCode).send({
      error: statusCode >= 500 ? 'InternalServerError' : normalized.name,
      message: statusCode >= 500 ? '服务器开小差了，请稍后再试' : normalized.message,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.method !== 'GET') {
      return reply.code(404).send({ error: 'NotFound', message: '接口不存在' });
    }
    if (request.url.startsWith('/api/') || request.url === '/health' || request.url === '/ready') {
      return reply.code(404).send({ error: 'NotFound', message: '接口不存在' });
    }
    if (request.url.startsWith('/admin') && existsSync(adminDist)) {
      return reply.sendFile('index.html', adminDist);
    }
    if (existsSync(publicDist)) {
      return reply.sendFile('index.html', publicDist);
    }
    return reply.code(404).send({ error: 'NotFound', message: '页面不存在' });
  });

  return app;
}

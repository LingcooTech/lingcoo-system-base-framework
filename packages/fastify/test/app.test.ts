import assert from 'node:assert/strict';
import test from 'node:test';

import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FastifyInstance } from 'fastify';

import { buildFastifyHost } from '../src/index.js';

test('zero-extension Fastify host starts without a database adapter', async () => {
  const app = await buildFastifyHost({ logger: false });
  const health = await app.inject({ method: 'GET', url: '/health' });
  const ready = await app.inject({ method: 'GET', url: '/ready' });

  assert.equal(health.statusCode, 200);
  assert.equal(ready.statusCode, 200);
  assert.equal(ready.json().database, 'not_configured');
  assert.deepEqual(app.frameKernel.system.extensions, []);
  await app.close();
});

test('Fastify adapter hosts routes selected by the Kernel extension engine', async () => {
  const extension = defineExtension({
    manifest: {
      id: 'fastify-test',
      version: '1.0.0',
      apiVersion: '1',
      frame: FRAME_VERSION,
      server: { routes: [{ method: 'GET', path: '/extension' }] },
    },
    server: defineServerExtension<FastifyInstance>({
      register({ app }) {
        app.get('/extension', async () => ({ status: 'ok' }));
      },
    }),
  });
  const system = defineSystem({
    id: 'fastify-test-system',
    version: '1.0.0',
    extensions: [extension],
  });
  const app = await buildFastifyHost({ system, logger: false });
  const response = await app.inject({ method: 'GET', url: '/extension' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: 'ok' });
  await app.close();
});

test('Fastify adapter denies protected routes when Identity is not installed', async () => {
  const app = await buildFastifyHost({ logger: false });
  app.get('/protected', { preHandler: app.requirePermission('test.read') }, async () => ({
    status: 'ok',
  }));

  const response = await app.inject({ method: 'GET', url: '/protected' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

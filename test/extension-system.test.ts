import assert from 'node:assert/strict';
import test from 'node:test';

import { exampleExtension } from '@lingcoo/frame-example-extension';
import {
  defineExtension,
  defineSystem,
  type ExtensionManifest,
} from '@lingcoo/frame-extension-sdk';
import { defineServerExtension } from '@lingcoo/frame-extension-sdk/server';

import { buildApp } from '../src/app.js';
import { frameCoreExtension } from '../src/extensions/core.js';
import { loadEnv } from '../src/lib/env.js';
import { collectSystemMigrationSources } from '../src/runtime/extensions.js';
import { createFrameWorker } from '../src/runtime/worker.js';

function testEnv() {
  return loadEnv({
    NODE_ENV: 'test',
    APP_NAME: 'frame-extension-test',
    APP_VERSION: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://frame:frame@127.0.0.1:1/frame_extension_test',
    AUTH_JWT_SECRET: 'frame-extension-test-secret-at-least-32-characters',
  });
}

function extension(id: string, contributions: Partial<ExtensionManifest> = {}) {
  return defineExtension({
    manifest: {
      id,
      version: '1.0.0',
      apiVersion: '1',
      frame: '^0.4.0',
      ...contributions,
    },
  });
}

function systemWith(...extensions: ReturnType<typeof extension>[]) {
  return defineSystem({ id: 'conflict-test', version: '1.0.0', extensions });
}

test('defineSystem sorts dependencies and permits event fan-out', () => {
  const foundation = extension('foundation', {
    worker: { subscriptions: ['shared.created'] },
  });
  const domain = extension('domain', {
    dependencies: [{ id: 'foundation', version: '^1.0.0' }],
    worker: { subscriptions: ['shared.created'] },
  });
  const system = systemWith(domain, foundation);
  assert.deepEqual(
    system.extensions.map((item) => item.manifest.id),
    ['foundation', 'domain'],
  );
});

test('defineSystem rejects invalid dependency graphs and contribution conflicts', () => {
  const cases: Array<{ name: string; extensions: ReturnType<typeof extension>[]; error: RegExp }> =
    [
      {
        name: 'duplicate extension',
        extensions: [extension('duplicate'), extension('duplicate')],
        error: /Duplicate extension id/,
      },
      {
        name: 'missing dependency',
        extensions: [
          extension('consumer', { dependencies: [{ id: 'missing', version: '^1.0.0' }] }),
        ],
        error: /missing dependency missing/,
      },
      {
        name: 'dependency version',
        extensions: [
          extension('foundation'),
          extension('consumer', { dependencies: [{ id: 'foundation', version: '^2.0.0' }] }),
        ],
        error: /requires foundation/,
      },
      {
        name: 'dependency cycle',
        extensions: [
          extension('alpha', { dependencies: [{ id: 'beta', version: '*' }] }),
          extension('beta', { dependencies: [{ id: 'alpha', version: '*' }] }),
        ],
        error: /dependency cycle/,
      },
      {
        name: 'Frame compatibility',
        extensions: [extension('future', { frame: '^1.0.0' })],
        error: /requires Frame/,
      },
      {
        name: 'permission',
        extensions: [
          extension('alpha', { permissions: ['shared.read'] }),
          extension('beta', { permissions: ['shared.read'] }),
        ],
        error: /Duplicate permission/,
      },
      {
        name: 'setting',
        extensions: [
          extension('alpha', { settings: ['shared.label'] }),
          extension('beta', { settings: ['shared.label'] }),
        ],
        error: /Duplicate setting/,
      },
      {
        name: 'route',
        extensions: [
          extension('alpha', { server: { routes: [{ method: 'GET', path: '/api/shared' }] } }),
          extension('beta', { server: { routes: [{ method: 'GET', path: '/api/shared' }] } }),
        ],
        error: /Duplicate route/,
      },
      {
        name: 'job kind',
        extensions: [
          extension('alpha', { worker: { jobs: ['shared.run'] } }),
          extension('beta', { worker: { jobs: ['shared.run'] } }),
        ],
        error: /Duplicate job kind/,
      },
      {
        name: 'migration source',
        extensions: [
          extension('alpha', {
            migrations: { sourceId: 'shared', migrations: [{ id: '0001_alpha.sql' }] },
          }),
          extension('beta', {
            migrations: { sourceId: 'shared', migrations: [{ id: '0001_beta.sql' }] },
          }),
        ],
        error: /Duplicate migration source/,
      },
      {
        name: 'Legacy Alias',
        extensions: [
          extension('alpha', {
            migrations: {
              sourceId: 'alpha',
              migrations: [{ id: '0001_alpha.sql', legacyAliases: ['0001_legacy.sql'] }],
            },
          }),
          extension('beta', {
            migrations: {
              sourceId: 'beta',
              migrations: [{ id: '0001_beta.sql', legacyAliases: ['0001_legacy.sql'] }],
            },
          }),
        ],
        error: /Duplicate Legacy Alias/,
      },
    ];

  for (const item of cases) {
    assert.throws(() => systemWith(...item.extensions), item.error, item.name);
  }
});

test('the reference extension composes across Server, Worker, settings and migrations', async () => {
  const system = defineSystem({
    id: 'example-system',
    version: '0.1.0',
    extensions: [exampleExtension, frameCoreExtension],
  });
  assert.deepEqual(
    system.extensions.map((item) => item.manifest.id),
    ['frame', 'example'],
  );
  assert.deepEqual(
    collectSystemMigrationSources(system).map((source) => source.id),
    ['frame', 'example'],
  );

  const app = await buildApp(testEnv(), { system });
  const response = await app.inject({ method: 'GET', url: '/api/example' });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { extension: 'example', status: 'ok' });
  assert.equal(
    app.settingsRegistry.find('example.greeting')?.defaultValue,
    'Hello from a Frame extension',
  );
  await app.close();

  const worker = createFrameWorker(testEnv(), { system });
  const status = worker.getStatus();
  assert.ok(status.jobKinds.includes('example.echo'));
  assert.ok(status.eventTopics.includes('example.created'));
  assert.deepEqual(status.extensions, ['frame', 'example']);
  await worker.dispose();
});

test('Server composition rejects extension routes that collide with Frame core', async () => {
  const collision = defineExtension({
    manifest: {
      id: 'collision',
      version: '1.0.0',
      apiVersion: '1',
      frame: '^0.4.0',
      dependencies: [{ id: 'frame', version: '^0.4.0' }],
      server: { routes: [{ method: 'GET', path: '/health' }] },
    },
    server: defineServerExtension({
      register({ app }) {
        app.get('/health', async () => ({ status: 'collision' }));
      },
    }),
  });
  const system = defineSystem({
    id: 'route-collision-system',
    version: '1.0.0',
    extensions: [frameCoreExtension, collision],
  });
  await assert.rejects(
    () => buildApp(testEnv(), { system }),
    /Extension route conflicts with an installed route: GET \/health/,
  );
});

test('runtime rejects a Defined System compiled for a different Frame version', async () => {
  const system = defineSystem({
    id: 'version-mismatch-system',
    version: '1.0.0',
    frameVersion: '0.4.1',
    extensions: [frameCoreExtension],
  });
  await assert.rejects(
    () => buildApp(testEnv(), { system }),
    /targets Frame 0\.4\.1, but this runtime is 0\.4\.0/,
  );
});

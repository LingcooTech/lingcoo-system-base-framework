import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';

import { frameCoreSystem, frameKernelExtension } from '../src/core/extension.js';
import { buildApp } from '../src/host/app.js';
import { loadEnv } from '../src/host/env.js';
import { SECURITY_PROVIDER_CAPABILITY, type SecurityProvider } from '../src/host/security.js';
import { frameKernelSystem } from '../src/kernel/system.js';

function testEnv() {
  return loadEnv({
    NODE_ENV: 'test',
    APP_NAME: 'lingcoo-system-base-framework',
    APP_VERSION: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://lingcoo:lingcoo@127.0.0.1:1/unused',
  });
}

test('health exposes framework identity without requiring a database connection', async () => {
  const app = await buildApp(testEnv());
  const response = await app.inject({ method: 'GET', url: '/health' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    status: 'ok',
    name: 'lingcoo-system-base-framework',
    version: 'test',
    environment: 'test',
    uptime: response.json().uptime,
  });
  await app.close();
});

test('unknown API routes use the standard error envelope', async () => {
  const app = await buildApp(testEnv());
  const response = await app.inject({ method: 'GET', url: '/api/unknown' });

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: 'NotFound', message: '接口不存在' });
  await app.close();
});

test('extension route validation errors use the standard client error envelope', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const response = await app.inject({ method: 'POST', url: '/api/auth/login' });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, 'ValidationError');
  assert.equal(response.json().message, '请求参数无效');
  await app.close();
});

test('system runtime requires an authenticated permission-bearing session', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const response = await app.inject({ method: 'GET', url: '/api/system/runtime' });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, '登录已过期，请重新登录');
  await app.close();
});

test('SMTP test delivery requires an authenticated integration permission', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const response = await app.inject({
    method: 'POST',
    url: '/api/integrations/connections/00000000-0000-4000-8000-000000000000/smtp/send-test',
    payload: {
      to: 'recipient@example.test',
      subject: 'Test',
      text: 'Test',
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, '登录已过期，请重新登录');
  await app.close();
});

test('job and notification management routes require authentication', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const [jobs, notifications] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/jobs' }),
    app.inject({ method: 'GET', url: '/api/notifications/admin' }),
  ]);
  assert.equal(jobs.statusCode, 401);
  assert.equal(notifications.statusCode, 401);
  await app.close();
});

test('asset library routes require authentication', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const [assets, upload] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/assets' }),
    app.inject({
      method: 'POST',
      url: '/api/assets/upload-intents',
      payload: {
        filename: 'example.png',
        mimeType: 'image/png',
        byteSize: 128,
        visibility: 'public',
      },
    }),
  ]);
  assert.equal(assets.statusCode, 401);
  assert.equal(upload.statusCode, 401);
  await app.close();
});

test('brand presentation management requires authentication', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const response = await app.inject({ method: 'GET', url: '/api/presentation' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('Frame Core does not install optional CMS routes', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const response = await app.inject({ method: 'GET', url: '/api/cms/entries' });
  assert.equal(response.statusCode, 404);
  await app.close();
});

test('metadata, search and data exchange routes require authentication', async () => {
  const app = await buildApp(testEnv(), { system: frameCoreSystem });
  const [metadata, search, datasets] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/metadata/summary' }),
    app.inject({ method: 'GET', url: '/api/search?q=test' }),
    app.inject({ method: 'GET', url: '/api/data-exchange/datasets' }),
  ]);
  assert.equal(metadata.statusCode, 401);
  assert.equal(search.statusCode, 401);
  assert.equal(datasets.statusCode, 401);
  await app.close();
});

test('applications can inject a SecurityProvider without the default JWT runtime', async () => {
  const securityProvider: SecurityProvider = {
    install({ app }) {
      return {
        async authenticate(request) {
          const permissions = request.headers['x-test-permissions'];
          if (typeof permissions !== 'string') {
            throw app.httpErrors.unauthorized('Custom authentication required');
          }
          return {
            subject: 'custom:user-1',
            type: 'custom-user',
            displayName: 'Custom User',
            roleCodes: ['custom'],
            permissions: permissions.split(',').filter(Boolean),
          };
        },
        authorize(principal, requiredPermissions) {
          return requiredPermissions.every((permission) =>
            principal.permissions.includes(permission),
          );
        },
      };
    },
  };
  const protectedExtension = defineExtension({
    manifest: {
      id: 'custom-security-test',
      version: '1.0.0',
      apiVersion: '1',
      frame: `^${FRAME_VERSION}`,
      dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
      server: { routes: [{ method: 'GET', path: '/api/custom-security' }] },
    },
    server: defineServerExtension({
      register({ app }) {
        app.get(
          '/api/custom-security',
          { preHandler: app.requirePermission('custom.read') },
          async (request) => ({
            subject: request.principal!.subject,
            legacyAccountId: request.auth!.accountId,
          }),
        );
      },
    }),
  });
  const system = defineSystem({
    id: 'custom-security-system',
    version: '1.0.0',
    extensions: [frameKernelExtension, protectedExtension],
  });
  const env = loadEnv({
    NODE_ENV: 'production',
    APP_NAME: 'custom-security-system',
    APP_VERSION: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://frame:frame@127.0.0.1:1/unused',
  });
  const app = await buildApp(env, { system, securityProvider });
  try {
    assert.equal(app.capabilities.has(SECURITY_PROVIDER_CAPABILITY), false);
    assert.equal(app.environment.has('frame-identity'), false);
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/custom-security',
      headers: { 'x-test-permissions': 'custom.read' },
    });
    assert.equal(allowed.statusCode, 200);
    assert.deepEqual(allowed.json(), {
      subject: 'custom:user-1',
      legacyAccountId: 'custom:user-1',
    });

    const forbidden = await app.inject({
      method: 'GET',
      url: '/api/custom-security',
      headers: { 'x-test-permissions': 'custom.other' },
    });
    assert.equal(forbidden.statusCode, 403);

    const unauthenticated = await app.inject({ method: 'GET', url: '/api/custom-security' });
    assert.equal(unauthenticated.statusCode, 401);
    assert.equal(unauthenticated.json().message, 'Custom authentication required');

    const defaultIdentityRoute = await app.inject({ method: 'POST', url: '/api/auth/login' });
    assert.equal(defaultIdentityRoute.statusCode, 404);
  } finally {
    await app.close();
  }
});

test('empty Kernel System starts without installing any extension', async () => {
  const app = await buildApp(testEnv(), { system: frameKernelSystem });
  try {
    const health = await app.inject({ method: 'GET', url: '/health' });
    assert.equal(health.statusCode, 200);
    assert.deepEqual(app.frameSystem.extensions, []);
    assert.equal(app.environment.has('frame-identity'), false);
    assert.equal(app.capabilities.has(SECURITY_PROVIDER_CAPABILITY), false);

    const identityRoute = await app.inject({ method: 'GET', url: '/api/auth/me' });
    const accessRoute = await app.inject({ method: 'GET', url: '/api/access/accounts' });
    assert.equal(identityRoute.statusCode, 404);
    assert.equal(accessRoute.statusCode, 404);

    const featureRoute = await app.inject({ method: 'GET', url: '/api/system/runtime' });
    assert.equal(featureRoute.statusCode, 404);
  } finally {
    await app.close();
  }
});

test('applications can replace Identity through a capability-providing extension', async () => {
  const customIdentityProvider: SecurityProvider = {
    install({ app }) {
      return {
        async authenticate(request) {
          if (request.headers['x-custom-identity'] !== 'allowed') {
            throw app.httpErrors.unauthorized('Custom Identity required');
          }
          return {
            subject: 'custom:identity-user',
            type: 'custom-identity',
            roleCodes: ['member'],
            permissions: ['custom.identity.read'],
          };
        },
        authorize(principal, requiredPermissions) {
          return requiredPermissions.every((permission) =>
            principal.permissions.includes(permission),
          );
        },
      };
    },
  };
  const customIdentityExtension = defineExtension({
    manifest: {
      id: 'custom-identity',
      version: '1.0.0',
      apiVersion: '1',
      frame: `^${FRAME_VERSION}`,
      dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
      capabilities: {
        server: {
          provides: [{ id: SECURITY_PROVIDER_CAPABILITY, version: '1.0.0' }],
        },
      },
      permissions: ['custom.identity.read'],
      server: { routes: [{ method: 'GET', path: '/api/custom-identity' }] },
    },
    server: defineServerExtension({
      capabilities: [{ id: SECURITY_PROVIDER_CAPABILITY, value: customIdentityProvider }],
      register({ app }) {
        app.get(
          '/api/custom-identity',
          { preHandler: app.requirePermission('custom.identity.read') },
          async (request) => ({ subject: request.principal!.subject }),
        );
      },
    }),
  });
  const system = defineSystem({
    id: 'custom-identity-extension-system',
    version: '1.0.0',
    extensions: [frameKernelExtension, customIdentityExtension],
  });

  const app = await buildApp(testEnv(), { system });
  try {
    const allowed = await app.inject({
      method: 'GET',
      url: '/api/custom-identity',
      headers: { 'x-custom-identity': 'allowed' },
    });
    assert.equal(allowed.statusCode, 200);
    assert.deepEqual(allowed.json(), { subject: 'custom:identity-user' });

    const rejected = await app.inject({ method: 'GET', url: '/api/custom-identity' });
    assert.equal(rejected.statusCode, 401);
    const defaultIdentityRoute = await app.inject({ method: 'GET', url: '/api/auth/me' });
    assert.equal(defaultIdentityRoute.statusCode, 404);
  } finally {
    await app.close();
  }
});

test('HEAD on SPA routes resolves the public shell like GET with security headers', async () => {
  const publicDir = mkdtempSync(join(tmpdir(), 'frame-public-'));
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>Frame</title>');
  const app = await buildApp(testEnv(), { staticAssets: { publicDirectory: publicDir } });
  try {
    for (const method of ['GET', 'HEAD'] as const) {
      const response = await app.inject({ method, url: '/framework' });
      assert.equal(response.statusCode, 200, `${method} /framework should serve the shell`);
      assert.match(response.headers['content-type'] as string, /text\/html/);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
      assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
    }
    // Non-GET/HEAD verbs still receive the API-style not-found envelope.
    const post = await app.inject({ method: 'POST', url: '/framework' });
    assert.equal(post.statusCode, 404);
    assert.deepEqual(post.json(), { error: 'NotFound', message: '接口不存在' });
  } finally {
    await app.close();
    rmSync(publicDir, { recursive: true, force: true });
  }
});

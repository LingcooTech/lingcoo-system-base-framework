import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/lib/env.js';

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

test('system runtime requires an authenticated permission-bearing session', async () => {
  const app = await buildApp(testEnv());
  const response = await app.inject({ method: 'GET', url: '/api/system/runtime' });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, '登录已过期，请重新登录');
  await app.close();
});

test('SMTP test delivery requires an authenticated integration permission', async () => {
  const app = await buildApp(testEnv());
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
  const app = await buildApp(testEnv());
  const [jobs, notifications] = await Promise.all([
    app.inject({ method: 'GET', url: '/api/jobs' }),
    app.inject({ method: 'GET', url: '/api/notifications/admin' }),
  ]);
  assert.equal(jobs.statusCode, 401);
  assert.equal(notifications.statusCode, 401);
  await app.close();
});

test('asset library routes require authentication', async () => {
  const app = await buildApp(testEnv());
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
  const app = await buildApp(testEnv());
  const response = await app.inject({ method: 'GET', url: '/api/presentation' });
  assert.equal(response.statusCode, 401);
  await app.close();
});

test('metadata, search and data exchange routes require authentication', async () => {
  const app = await buildApp(testEnv());
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

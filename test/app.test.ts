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

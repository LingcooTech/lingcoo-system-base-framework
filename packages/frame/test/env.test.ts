import assert from 'node:assert/strict';
import test from 'node:test';

import { buildApp } from '../src/host/app.js';
import { frameCoreSystem } from '../src/core/extension.js';
import { loadEnv } from '../src/host/env.js';
import { createSystemEnvironmentRegistry } from '../src/runtime/environment.js';

test('Identity configuration belongs to the installed extension, not AppEnv', () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    AUTH_COOKIE_NAME: 'custom_session',
    AUTH_SESSION_TTL_HOURS: '24',
  });
  assert.equal('AUTH_COOKIE_NAME' in env, false);
  assert.equal('AUTH_SESSION_TTL_HOURS' in env, false);

  const environment = createSystemEnvironmentRegistry(frameCoreSystem, env);
  assert.deepEqual(environment.require('frame-identity'), {
    NODE_ENV: 'test',
    AUTH_JWT_SECRET: undefined,
    AUTH_COOKIE_NAME: 'custom_session',
    AUTH_SESSION_TTL_HOURS: 24,
    AUTH_BOOTSTRAP_EMAIL: undefined,
    AUTH_BOOTSTRAP_PASSWORD: undefined,
    AUTH_BOOTSTRAP_DISPLAY_NAME: '系统所有者',
  });
});

test('the default security provider requires an explicit production JWT secret', async () => {
  const env = loadEnv({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://frame:frame@example.test/frame',
    LOG_LEVEL: 'silent',
  });
  await assert.rejects(() => buildApp(env, { system: frameCoreSystem }), /AUTH_JWT_SECRET/);
});

test('the default identity module validates bootstrap credential pairs', async () => {
  const env = loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://frame:frame@example.test/frame',
    AUTH_BOOTSTRAP_EMAIL: 'owner@example.test',
  });
  await assert.rejects(
    () => buildApp(env, { system: frameCoreSystem }),
    /Bootstrap email and password/,
  );
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadEnv } from '../src/lib/env.js';

test('production requires an explicit JWT secret', () => {
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://frame:frame@example.test/frame',
      }),
    /AUTH_JWT_SECRET/,
  );
});

test('bootstrap credentials must be configured as a pair', () => {
  assert.throws(
    () =>
      loadEnv({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgres://frame:frame@example.test/frame',
        AUTH_BOOTSTRAP_EMAIL: 'owner@example.test',
      }),
    /Bootstrap email and password/,
  );
});

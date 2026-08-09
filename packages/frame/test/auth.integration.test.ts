import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import {
  accountRoles,
  accounts,
  passwordCredentials,
  roles as roleRecords,
} from '@lingcootech/frame-database/schema';
import { hashPassword } from '../src/core/modules/auth/password.js';
import { buildApp } from '../src/host/app.js';
import { loadEnv } from '../src/host/env.js';

const databaseUrl = process.env.DATABASE_URL;
const initialPassword = 'Frame-bootstrap-2026!';
const changedPassword = 'Frame-changed-2026!!';

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

test(
  'cookie session supports login, authorization, password change and revocation',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_NAME: 'lingcoo-system-base-framework',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'frame-integration-jwt-secret-with-32-characters',
      }),
    );

    const email = `frame-owner-${randomUUID()}@example.test`;
    const [ownerRole] = await app.db
      .select({ id: roleRecords.id })
      .from(roleRecords)
      .where(eq(roleRecords.code, 'owner'))
      .limit(1);
    assert.ok(ownerRole);
    const [account] = await app.db
      .insert(accounts)
      .values({ email, displayName: 'Frame Owner' })
      .returning({ id: accounts.id });
    await app.db.insert(passwordCredentials).values({
      accountId: account.id,
      passwordHash: await hashPassword(initialPassword),
    });
    await app.db.insert(accountRoles).values({ accountId: account.id, roleId: ownerRole.id });

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: initialPassword },
    });
    assert.equal(login.statusCode, 200);
    assert.equal('token' in login.json(), false);
    assert.match(String(login.headers['set-cookie']), /HttpOnly/i);
    assert.match(String(login.headers['set-cookie']), /SameSite=Lax/i);
    const cookie = sessionCookie(login);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    assert.equal(me.statusCode, 200);
    assert.deepEqual(
      me.json().account.roles.map((role: { code: string }) => role.code),
      ['owner'],
    );
    assert.equal(me.json().account.permissions.includes('admin.access'), true);

    const roles = await app.inject({
      method: 'GET',
      url: '/api/access/roles',
      headers: { cookie },
    });
    assert.equal(roles.statusCode, 200);
    assert.equal(
      roles.json().items.some((role: { code: string }) => role.code === 'viewer'),
      true,
    );

    const changePassword = await app.inject({
      method: 'POST',
      url: '/api/auth/change-password',
      headers: { cookie },
      payload: {
        currentPassword: initialPassword,
        newPassword: changedPassword,
        confirmPassword: changedPassword,
      },
    });
    assert.equal(changePassword.statusCode, 200);

    const oldPasswordLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: initialPassword },
    });
    assert.equal(oldPasswordLogin.statusCode, 401);

    const newPasswordLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: changedPassword },
    });
    assert.equal(newPasswordLogin.statusCode, 200);
    const newCookie = sessionCookie(newPasswordLogin);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { cookie: newCookie },
    });
    assert.equal(logout.statusCode, 200);

    const revoked = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: newCookie },
    });
    assert.equal(revoked.statusCode, 401);

    await app.close();
  },
);

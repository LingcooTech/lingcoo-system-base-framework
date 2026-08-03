import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { desc, eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import {
  accountRoles,
  accounts,
  integrationConnections,
  notificationDeliveries,
  passwordCredentials,
  presentationProfiles,
  roles,
} from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import { decryptSetting, encryptSetting } from '../src/lib/settings-crypto.js';

const databaseUrl = process.env.DATABASE_URL;
const encryptionKey = 'account-security-integration-key-2026';

function cookieFrom(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

function tokenFromEncryptedContent(value: unknown) {
  const content = decryptSetting<{ text: string }>(value, encryptionKey);
  const match = content.text.match(/[?&]token=([A-Za-z0-9_-]+)/);
  assert.ok(match?.[1]);
  return match[1];
}

test(
  'account security supports profile, sessions, verification, reset and invitation',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        SETTINGS_ENCRYPTION_KEY: encryptionKey,
        AUTH_JWT_SECRET: 'account-security-test-jwt-secret-2026',
      }),
    );
    await app.db
      .insert(presentationProfiles)
      .values({ id: 'default', displayName: 'Frame Test', publicUrl: 'https://frame.example.test' })
      .onConflictDoUpdate({
        target: presentationProfiles.id,
        set: { publicUrl: 'https://frame.example.test' },
      });
    await app.db.insert(integrationConnections).values({
      providerCode: 'smtp',
      name: 'Security SMTP',
      enabled: true,
      config: {
        host: 'smtp.example.test',
        port: 465,
        secure: true,
        requireTls: true,
        user: 'mailer@example.test',
        from: 'Frame <mailer@example.test>',
      },
      encryptedCredentials: encryptSetting({ password: 'smtp-password' }, encryptionKey),
      credentialKeys: ['password'],
    });

    const runId = randomUUID();
    const email = `security-owner-${runId}@example.test`;
    const oldPassword = 'Security-owner-old-2026!';
    const [ownerRole] = await app.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'owner'));
    assert.ok(ownerRole);
    const [owner] = await app.db
      .insert(accounts)
      .values({ email, displayName: 'Security Owner' })
      .returning({ id: accounts.id });
    await app.db.insert(passwordCredentials).values({
      accountId: owner.id,
      passwordHash: await hashPassword(oldPassword),
    });
    await app.db.insert(accountRoles).values({ accountId: owner.id, roleId: ownerRole.id });

    const loginOne = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: oldPassword },
      headers: { 'user-agent': 'Chrome on test one' },
    });
    const loginTwo = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: oldPassword },
      headers: { 'user-agent': 'Chrome on test two' },
    });
    assert.equal(loginOne.statusCode, 200);
    assert.equal(loginTwo.statusCode, 200);
    const cookie = cookieFrom(loginTwo);

    const profile = await app.inject({
      method: 'PATCH',
      url: '/api/account/profile',
      headers: { cookie },
      payload: { displayName: 'Updated Security Owner', avatarAssetId: null },
    });
    assert.equal(profile.statusCode, 200);
    assert.equal(profile.json().profile.displayName, 'Updated Security Owner');

    const sessions = await app.inject({
      method: 'GET',
      url: '/api/account/sessions',
      headers: { cookie },
    });
    assert.equal(sessions.statusCode, 200);
    assert.equal(
      sessions.json().items.filter((item: { revokedAt: string | null }) => !item.revokedAt).length,
      2,
    );
    const revokeOthers = await app.inject({
      method: 'POST',
      url: '/api/account/sessions/revoke-others',
      headers: { cookie },
    });
    assert.equal(revokeOthers.json().count, 1);

    const verification = await app.inject({
      method: 'POST',
      url: '/api/account/email-verification',
      headers: { cookie },
    });
    assert.equal(verification.statusCode, 202);
    const [verificationDelivery] = await app.db
      .select({ encryptedContent: notificationDeliveries.encryptedContent })
      .from(notificationDeliveries)
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(1);
    const verificationToken = tokenFromEncryptedContent(verificationDelivery.encryptedContent);
    const verified = await app.inject({
      method: 'POST',
      url: '/api/auth/email/verify',
      payload: { token: verificationToken },
    });
    assert.equal(verified.statusCode, 200);

    const resetRequest = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      payload: { email },
    });
    assert.equal(resetRequest.statusCode, 202);
    const [resetDelivery] = await app.db
      .select({ encryptedContent: notificationDeliveries.encryptedContent })
      .from(notificationDeliveries)
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(1);
    const resetToken = tokenFromEncryptedContent(resetDelivery.encryptedContent);
    const newPassword = 'Security-owner-new-2026!';
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/complete',
      payload: { token: resetToken, newPassword, confirmPassword: newPassword },
    });
    assert.equal(reset.statusCode, 200);
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: oldPassword },
    });
    assert.equal(oldLogin.statusCode, 401);
    const newLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: newPassword },
    });
    assert.equal(newLogin.statusCode, 200);
    const ownerCookie = cookieFrom(newLogin);

    const inviteEmail = `invited-user-${runId}@example.test`;
    const invited = await app.inject({
      method: 'POST',
      url: '/api/access/accounts',
      headers: { cookie: ownerCookie },
      payload: {
        email: inviteEmail,
        displayName: 'Invited User',
        setupMethod: 'invitation',
        roleCodes: ['viewer'],
      },
    });
    assert.equal(invited.statusCode, 201);
    const [invitationDelivery] = await app.db
      .select({ encryptedContent: notificationDeliveries.encryptedContent })
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.destination, inviteEmail))
      .orderBy(desc(notificationDeliveries.createdAt))
      .limit(1);
    const invitationToken = tokenFromEncryptedContent(invitationDelivery.encryptedContent);
    const invitedPassword = 'Invited-user-password-2026!';
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/auth/invitations/accept',
      payload: {
        token: invitationToken,
        newPassword: invitedPassword,
        confirmPassword: invitedPassword,
      },
    });
    assert.equal(accepted.statusCode, 200);
    const invitedLogin = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: inviteEmail, password: invitedPassword },
    });
    assert.equal(invitedLogin.statusCode, 200);
    assert.ok(invitedLogin.json().account.emailVerifiedAt);
    await app.close();
  },
);

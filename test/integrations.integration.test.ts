import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import {
  accountRoles,
  accounts,
  integrationConnections,
  passwordCredentials,
  roles,
} from '@lingcoo/frame-database/schema';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import { createIntegrationProviderRegistry } from '../src/modules/integrations/registry.js';
import { IntegrationService } from '../src/modules/integrations/service.js';

const databaseUrl = process.env.DATABASE_URL;
const ownerEmail = 'integration-owner@example.test';
const ownerPassword = 'Integration-owner-2026!';
const encryptionKey = 'integration-settings-encryption-key-32-characters';

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

test(
  'provider lifecycle encrypts credentials, gates enablement and records connection tests',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_NAME: 'lingcoo-system-base-framework',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'integration-jwt-secret-with-at-least-32-characters',
        SETTINGS_ENCRYPTION_KEY: encryptionKey,
      }),
    );

    const [ownerRole] = await app.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'owner'))
      .limit(1);
    assert.ok(ownerRole);
    const [owner] = await app.db
      .insert(accounts)
      .values({ email: ownerEmail, displayName: 'Integration Owner' })
      .onConflictDoUpdate({ target: accounts.email, set: { status: 'active' } })
      .returning({ id: accounts.id });
    const passwordHash = await hashPassword(ownerPassword);
    await app.db
      .insert(passwordCredentials)
      .values({ accountId: owner.id, passwordHash })
      .onConflictDoUpdate({
        target: passwordCredentials.accountId,
        set: { passwordHash, updatedAt: new Date() },
      });
    await app.db
      .insert(accountRoles)
      .values({ accountId: owner.id, roleId: ownerRole.id })
      .onConflictDoNothing();

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: ownerEmail, password: ownerPassword },
    });
    assert.equal(login.statusCode, 200);
    const cookie = sessionCookie(login);

    const providers = await app.inject({
      method: 'GET',
      url: '/api/integrations/providers',
      headers: { cookie },
    });
    assert.equal(providers.statusCode, 200);
    assert.equal(
      providers
        .json()
        .items.some(
          (provider: { code: string; availability: string }) =>
            provider.code === 'framework-diagnostic' && provider.availability === 'available',
        ),
      true,
    );
    assert.equal(
      providers
        .json()
        .items.some(
          (provider: { code: string; availability: string }) =>
            provider.code === 'smtp' && provider.availability === 'available',
        ),
      true,
    );

    const create = await app.inject({
      method: 'POST',
      url: '/api/integrations/connections',
      headers: { cookie },
      payload: {
        providerCode: 'framework-diagnostic',
        name: 'Diagnostic connection',
        config: { responseMessage: 'diagnostic ready' },
        credentials: { token: 'diagnostic-secret' },
      },
    });
    assert.equal(create.statusCode, 201);
    const connection = create.json().connection as { id: string; credentialKeys: string[] };
    assert.deepEqual(connection.credentialKeys, ['token']);
    assert.equal(JSON.stringify(create.json()).includes('diagnostic-secret'), false);

    const [stored] = await app.db
      .select()
      .from(integrationConnections)
      .where(eq(integrationConnections.id, connection.id))
      .limit(1);
    assert.ok(stored);
    assert.equal(JSON.stringify(stored.encryptedCredentials).includes('diagnostic-secret'), false);

    const enableBeforeTest = await app.inject({
      method: 'PATCH',
      url: `/api/integrations/connections/${connection.id}`,
      headers: { cookie },
      payload: { enabled: true },
    });
    assert.equal(enableBeforeTest.statusCode, 409);

    const connectionTest = await app.inject({
      method: 'POST',
      url: `/api/integrations/connections/${connection.id}/test`,
      headers: { cookie },
    });
    assert.equal(connectionTest.statusCode, 200);
    assert.deepEqual(connectionTest.json().result.ok, true);
    assert.equal(connectionTest.json().result.message, 'diagnostic ready');

    const enable = await app.inject({
      method: 'PATCH',
      url: `/api/integrations/connections/${connection.id}`,
      headers: { cookie },
      payload: { enabled: true },
    });
    assert.equal(enable.statusCode, 200);
    assert.equal(enable.json().connection.enabled, true);

    const service = new IntegrationService(
      app.db,
      createIntegrationProviderRegistry('test'),
      encryptionKey,
    );
    const execution = await service.executeConnection({
      connectionId: connection.id,
      providerCode: 'framework-diagnostic',
      operation: 'diagnostic.invoke',
      actorId: owner.id,
      execute: async ({ credentials }) => {
        assert.equal(credentials.token, 'diagnostic-secret');
        return {
          value: 'executed',
          message: 'diagnostic operation complete',
          metadata: { reflectedToken: credentials.token },
        };
      },
    });
    assert.equal(execution, 'executed');

    const rotateCredential = await app.inject({
      method: 'PATCH',
      url: `/api/integrations/connections/${connection.id}`,
      headers: { cookie },
      payload: { credentials: { token: 'replacement-secret' } },
    });
    assert.equal(rotateCredential.statusCode, 200);
    assert.equal(rotateCredential.json().connection.enabled, false);
    assert.equal(rotateCredential.json().connection.lastTestStatus, null);
    assert.equal(JSON.stringify(rotateCredential.json()).includes('replacement-secret'), false);

    const failedTest = await app.inject({
      method: 'POST',
      url: `/api/integrations/connections/${connection.id}/test`,
      headers: { cookie },
    });
    assert.equal(failedTest.statusCode, 200);
    assert.equal(failedTest.json().result.ok, false);
    assert.equal(JSON.stringify(failedTest.json()).includes('replacement-secret'), false);

    const events = await app.inject({
      method: 'GET',
      url: `/api/integrations/connections/${connection.id}/events`,
      headers: { cookie },
    });
    assert.equal(events.statusCode, 200);
    assert.equal(JSON.stringify(events.json()).includes('diagnostic-secret'), false);
    assert.equal(JSON.stringify(events.json()).includes('replacement-secret'), false);
    assert.deepEqual(
      events.json().items.map((event: { operation: string }) => event.operation),
      ['connection.test', 'diagnostic.invoke', 'connection.test'],
    );

    await app.close();
  },
);

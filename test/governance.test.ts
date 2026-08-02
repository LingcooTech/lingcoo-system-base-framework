import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { accountRoles, accounts, passwordCredentials, roles } from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import { findSettingDefinition, settingDefinitions } from '../src/modules/settings/registry.js';

test('setting registry exposes only typed, non-secret framework settings', () => {
  assert.ok(settingDefinitions.length >= 5);
  assert.equal(findSettingDefinition('general.system_name')?.schema.parse('Demo'), 'Demo');
  assert.equal(
    findSettingDefinition('localization.timezone')?.schema.safeParse('Mars/Base').success,
    false,
  );
  assert.equal(
    settingDefinitions.some((item) => /secret|password|token|credential/i.test(item.key)),
    false,
  );
});

const databaseUrl = process.env.DATABASE_URL;

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

test(
  'settings are versioned and their updates are available in audit query',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'governance-test-secret-with-32-characters',
      }),
    );
    const email = 'governance-owner@example.test';
    const password = 'Governance-owner-2026!';
    const [ownerRole] = await app.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'owner'))
      .limit(1);
    assert.ok(ownerRole);
    const [account] = await app.db
      .insert(accounts)
      .values({ email, displayName: 'Governance Owner' })
      .onConflictDoUpdate({ target: accounts.email, set: { status: 'active' } })
      .returning({ id: accounts.id });
    const passwordHash = await hashPassword(password);
    await app.db
      .insert(passwordCredentials)
      .values({ accountId: account.id, passwordHash })
      .onConflictDoUpdate({ target: passwordCredentials.accountId, set: { passwordHash } });
    await app.db
      .insert(accountRoles)
      .values({ accountId: account.id, roleId: ownerRole.id })
      .onConflictDoNothing();
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    assert.equal(login.statusCode, 200);
    const cookie = sessionCookie(login);

    const update = await app.inject({
      method: 'PATCH',
      url: '/api/system/settings/general.system_name',
      headers: { cookie },
      payload: { value: 'Governance Test', reason: 'automated verification' },
    });
    assert.equal(update.statusCode, 200);
    assert.ok(update.json().setting.version >= 1);

    const history = await app.inject({
      method: 'GET',
      url: '/api/system/settings/general.system_name/history',
      headers: { cookie },
    });
    assert.equal(history.statusCode, 200);
    assert.equal(history.json().items[0].value, 'Governance Test');
    assert.equal(history.json().items[0].changeReason, 'automated verification');

    const unknown = await app.inject({
      method: 'PATCH',
      url: '/api/system/settings/provider.secret',
      headers: { cookie },
      payload: { value: 'forbidden' },
    });
    assert.equal(unknown.statusCode, 404);

    const audit = await app.inject({
      method: 'GET',
      url: '/api/audit?action=system.setting_updated',
      headers: { cookie },
    });
    assert.equal(audit.statusCode, 200);
    assert.ok(
      audit
        .json()
        .items.some((item: { resourceId: string }) => item.resourceId === 'general.system_name'),
    );

    const presentationPayload = {
      displayName: 'Governance Brand',
      shortName: 'GB',
      slogan: 'Shared presentation foundation',
      fullLogoAssetId: null,
      squareLogoAssetId: null,
      darkLogoAssetId: null,
      faviconAssetId: null,
      socialImageAssetId: null,
      primaryColor: '#315f47',
      secondaryColor: '#b9efc5',
      accentColor: '#39735a',
      contactEmail: 'brand@example.test',
      contactPhone: null,
      contactAddress: null,
      publicUrl: 'https://example.test',
      seoTitle: 'Governance Brand',
      seoDescription: 'Presentation integration verification.',
      headerNavigation: [{ label: '首页', href: '/' }],
      footerLinks: [],
      footerCopyright: 'Governance Brand',
      filingInfo: null,
      changeReason: 'automated presentation verification',
    };
    const presentationUpdate = await app.inject({
      method: 'PATCH',
      url: '/api/presentation',
      headers: { cookie },
      payload: presentationPayload,
    });
    assert.equal(presentationUpdate.statusCode, 200);
    assert.equal(presentationUpdate.json().presentation.displayName, 'Governance Brand');

    const publicPresentation = await app.inject({
      method: 'GET',
      url: '/api/public/presentation',
    });
    assert.equal(publicPresentation.statusCode, 200);
    assert.equal(publicPresentation.json().presentation.displayName, 'Governance Brand');

    const presentationHistory = await app.inject({
      method: 'GET',
      url: '/api/presentation/history',
      headers: { cookie },
    });
    assert.equal(presentationHistory.statusCode, 200);
    assert.equal(
      presentationHistory.json().items[0].changeReason,
      'automated presentation verification',
    );
    await app.close();
  },
);

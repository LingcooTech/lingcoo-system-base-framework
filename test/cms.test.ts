import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { accountRoles, accounts, passwordCredentials, roles } from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import { cmsContentInputSchema } from '../src/modules/cms/schemas.js';

test('CMS schema keeps content generic and validates stable slugs', () => {
  const base = {
    type: 'page',
    slug: 'about-us',
    title: 'About',
    excerpt: null,
    body: '# About',
    coverAssetId: null,
    socialImageAssetId: null,
    pinned: false,
    seoTitle: null,
    seoDescription: null,
    termIds: [],
  };
  assert.equal(cmsContentInputSchema.parse(base).slug, 'about-us');
  assert.equal(cmsContentInputSchema.safeParse({ ...base, slug: 'About Us' }).success, false);
});

const databaseUrl = process.env.DATABASE_URL;

function cookieFrom(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

test(
  'CMS supports draft, versions, preview, publish and public rendering',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'cms-test-secret-with-at-least-32-characters',
      }),
    );
    const email = 'cms-owner@example.test';
    const password = 'Cms-owner-password-2026!';
    const [ownerRole] = await app.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'owner'));
    assert.ok(ownerRole);
    const [account] = await app.db
      .insert(accounts)
      .values({ email, displayName: 'CMS Owner' })
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
    const cookie = cookieFrom(login);
    const payload = {
      type: 'article',
      slug: 'frame-cms-test',
      title: 'Frame CMS Test',
      excerpt: 'A generic CMS lifecycle.',
      body: '# Frame CMS\n\nReusable content.',
      coverAssetId: null,
      socialImageAssetId: null,
      pinned: true,
      seoTitle: 'Frame CMS Test',
      seoDescription: 'CMS integration test.',
      termIds: [],
      changeReason: 'initial draft',
    };
    const created = await app.inject({
      method: 'POST',
      url: '/api/cms/entries',
      headers: { cookie },
      payload,
    });
    assert.equal(created.statusCode, 201);
    const contentId = created.json().content.id as string;
    assert.equal(created.json().content.status, 'draft');

    const hidden = await app.inject({
      method: 'GET',
      url: '/api/public/cms/articles/frame-cms-test',
    });
    assert.equal(hidden.statusCode, 404);
    const preview = await app.inject({
      method: 'GET',
      url: `/api/cms/entries/${contentId}/preview`,
      headers: { cookie },
    });
    assert.equal(preview.statusCode, 200);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/cms/entries/${contentId}`,
      headers: { cookie },
      payload: { ...payload, body: payload.body + '\n\nUpdated.', changeReason: 'second version' },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.json().content.currentVersion, 2);
    const versions = await app.inject({
      method: 'GET',
      url: `/api/cms/entries/${contentId}/versions`,
      headers: { cookie },
    });
    assert.equal(versions.json().items.length, 2);

    const published = await app.inject({
      method: 'POST',
      url: `/api/cms/entries/${contentId}/status`,
      headers: { cookie },
      payload: { status: 'published' },
    });
    assert.equal(published.statusCode, 200);
    const publicContent = await app.inject({
      method: 'GET',
      url: '/api/public/cms/articles/frame-cms-test',
    });
    assert.equal(publicContent.statusCode, 200);
    assert.equal(publicContent.json().content.title, 'Frame CMS Test');
    await app.close();
  },
);

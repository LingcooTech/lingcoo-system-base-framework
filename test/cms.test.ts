import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { accountRoles, accounts, passwordCredentials, roles } from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import {
  cmsContentInputSchema,
  cmsRedirectInputSchema,
  cmsScheduleSchema,
  publicCmsListSchema,
} from '../src/modules/cms/schemas.js';

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
  assert.deepEqual(publicCmsListSchema.parse({ page: '2', limit: '20' }), {
    page: 2,
    pageSize: 20,
  });
});

test('CMS redirect and schedule schemas reject unsafe workflow inputs', () => {
  assert.deepEqual(
    cmsRedirectInputSchema.parse({
      sourcePath: '/old-about',
      targetPath: '/pages/about',
      statusCode: 301,
      enabled: true,
    }),
    {
      sourcePath: '/old-about',
      targetPath: '/pages/about',
      statusCode: 301,
      enabled: true,
    },
  );
  assert.equal(
    cmsRedirectInputSchema.safeParse({
      sourcePath: '//external.example/path',
      targetPath: '/pages/about',
    }).success,
    false,
  );
  assert.equal(
    cmsRedirectInputSchema.safeParse({
      sourcePath: '/old-about?preview=true',
      targetPath: '/pages/about',
    }).success,
    false,
  );
  assert.equal(
    cmsRedirectInputSchema.safeParse({
      sourcePath: '/same-path',
      targetPath: '/same-path',
    }).success,
    false,
  );
  assert.equal(
    cmsRedirectInputSchema.safeParse({
      sourcePath: '/old-about',
      targetPath: 'https://external.example/about',
    }).success,
    false,
  );
  assert.equal(
    cmsScheduleSchema.parse({ publishAt: '2026-08-03T14:30:00+08:00' }).publishAt,
    '2026-08-03T14:30:00+08:00',
  );
  assert.equal(cmsScheduleSchema.parse({ publishAt: null }).publishAt, null);
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
    const publicList = await app.inject({
      method: 'GET',
      url: '/api/public/cms/articles?page=1&pageSize=12',
    });
    assert.equal(publicList.statusCode, 200);
    assert.equal(publicList.json().page, 1);
    assert.ok(publicList.json().total >= 1);
    assert.ok(publicList.json().items.some((item: { id: string }) => item.id === contentId));

    const sitemap = await app.inject({ method: 'GET', url: '/sitemap.xml' });
    assert.equal(sitemap.statusCode, 200);
    assert.match(sitemap.body, /articles\/frame-cms-test/);
    const robots = await app.inject({ method: 'GET', url: '/robots.txt' });
    assert.equal(robots.statusCode, 200);
    assert.match(robots.body, /Sitemap:/);

    const publishAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const scheduled = await app.inject({
      method: 'POST',
      url: `/api/cms/entries/${contentId}/schedule`,
      headers: { cookie },
      payload: { publishAt },
    });
    assert.equal(scheduled.statusCode, 200);
    assert.equal(scheduled.json().content.status, 'draft');
    assert.equal(scheduled.json().content.scheduledPublishAt, publishAt);
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/cms/entries/${contentId}/schedule`,
      headers: { cookie },
      payload: { publishAt: null },
    });
    assert.equal(cancelled.statusCode, 200);
    assert.equal(cancelled.json().content.scheduledPublishAt, null);

    const sourcePath = `/legacy-${contentId}`;
    const redirectCreated = await app.inject({
      method: 'POST',
      url: '/api/cms/redirects',
      headers: { cookie },
      payload: {
        sourcePath,
        targetPath: '/articles/frame-cms-test',
        statusCode: 301,
        enabled: true,
      },
    });
    assert.equal(redirectCreated.statusCode, 201);
    const redirectId = redirectCreated.json().redirect.id as string;
    const redirected = await app.inject({ method: 'GET', url: sourcePath });
    assert.equal(redirected.statusCode, 301);
    assert.equal(redirected.headers.location, '/articles/frame-cms-test');
    const redirectList = await app.inject({
      method: 'GET',
      url: '/api/cms/redirects',
      headers: { cookie },
    });
    assert.equal(redirectList.statusCode, 200);
    assert.ok(redirectList.json().items.some((item: { id: string }) => item.id === redirectId));
    const redirectUpdated = await app.inject({
      method: 'PATCH',
      url: `/api/cms/redirects/${redirectId}`,
      headers: { cookie },
      payload: {
        sourcePath,
        targetPath: '/articles/frame-cms-test',
        statusCode: 302,
        enabled: false,
      },
    });
    assert.equal(redirectUpdated.statusCode, 200);
    assert.equal(redirectUpdated.json().redirect.enabled, false);
    const redirectDeleted = await app.inject({
      method: 'DELETE',
      url: `/api/cms/redirects/${redirectId}`,
      headers: { cookie },
    });
    assert.equal(redirectDeleted.statusCode, 204);
    await app.close();
  },
);

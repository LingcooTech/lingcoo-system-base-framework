import assert from 'node:assert/strict';
import test from 'node:test';

import { eq } from 'drizzle-orm';

import { buildApp } from '../src/app.js';
import { accountRoles, accounts, passwordCredentials, roles } from '../src/db/schema.js';
import { loadEnv } from '../src/lib/env.js';
import { hashPassword } from '../src/lib/password.js';
import { DatasetRegistry } from '../src/modules/data-exchange/registry.js';
import { SearchProviderRegistry } from '../src/modules/search/registry.js';

test('search and dataset registries reject duplicate adapter codes', () => {
  const search = new SearchProviderRegistry();
  const provider = {
    code: 'example',
    label: 'Example',
    permission: 'search.use' as const,
    async search() {
      return [];
    },
  };
  search.register(provider);
  assert.throws(() => search.register(provider), /already registered/);

  const datasets = new DatasetRegistry();
  const adapter = {
    code: 'example.records',
    name: 'Example',
    description: 'Example dataset',
    async export() {
      return {
        formatVersion: 1 as const,
        dataset: 'example.records',
        exportedAt: new Date().toISOString(),
        records: [],
      };
    },
    async preview() {
      return { valid: true, recordCount: 0, creates: 0, updates: 0, errors: [] };
    },
    async apply() {
      return { valid: true, recordCount: 0, creates: 0, updates: 0, errors: [] };
    },
  };
  datasets.register(adapter);
  assert.throws(() => datasets.register(adapter), /already registered/);
});

const databaseUrl = process.env.DATABASE_URL;

function sessionCookie(response: { headers: Record<string, string | string[] | undefined> }) {
  const header = response.headers['set-cookie'];
  const value = Array.isArray(header) ? header[0] : header;
  assert.ok(value);
  return value.split(';', 1)[0];
}

test(
  'metadata, classification, search and data exchange form one reusable lifecycle',
  { skip: !databaseUrl },
  async () => {
    const app = await buildApp(
      loadEnv({
        NODE_ENV: 'test',
        APP_VERSION: 'test',
        LOG_LEVEL: 'silent',
        DATABASE_URL: databaseUrl,
        AUTH_JWT_SECRET: 'metadata-exchange-test-secret-32-characters',
      }),
    );
    const email = 'metadata-owner@example.test';
    const password = 'Metadata-owner-2026!';
    const [ownerRole] = await app.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, 'owner'))
      .limit(1);
    assert.ok(ownerRole);
    const [account] = await app.db
      .insert(accounts)
      .values({ email, displayName: 'Metadata Owner' })
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
    const suffix = crypto.randomUUID().slice(0, 8);
    const dictionaryCode = `test.level_${suffix}`;
    const taxonomyCode = `test.category_${suffix}`;

    const dictionary = await app.inject({
      method: 'POST',
      url: '/api/metadata/dictionaries',
      headers: { cookie },
      payload: { code: dictionaryCode, name: `测试等级 ${suffix}`, valueType: 'number' },
    });
    assert.equal(dictionary.statusCode, 201);
    const invalidItem = await app.inject({
      method: 'POST',
      url: `/api/metadata/dictionaries/${dictionaryCode}/items`,
      headers: { cookie },
      payload: { code: 'high', label: '高级', value: '3' },
    });
    assert.equal(invalidItem.statusCode, 422);
    const validItem = await app.inject({
      method: 'POST',
      url: `/api/metadata/dictionaries/${dictionaryCode}/items`,
      headers: { cookie },
      payload: { code: 'high', label: '高级', value: 3 },
    });
    assert.equal(validItem.statusCode, 201);

    const taxonomy = await app.inject({
      method: 'POST',
      url: '/api/metadata/taxonomies',
      headers: { cookie },
      payload: {
        code: taxonomyCode,
        name: `测试分类 ${suffix}`,
        kind: 'category',
        hierarchical: true,
      },
    });
    assert.equal(taxonomy.statusCode, 201);
    const root = await app.inject({
      method: 'POST',
      url: `/api/metadata/taxonomies/${taxonomyCode}/terms`,
      headers: { cookie },
      payload: { code: 'root', name: '根节点' },
    });
    assert.equal(root.statusCode, 201);
    const child = await app.inject({
      method: 'POST',
      url: `/api/metadata/taxonomies/${taxonomyCode}/terms`,
      headers: { cookie },
      payload: { code: 'child', name: '子节点', parentId: root.json().term.id },
    });
    assert.equal(child.statusCode, 201);
    const cycle = await app.inject({
      method: 'PATCH',
      url: `/api/metadata/taxonomies/${taxonomyCode}/terms/${root.json().term.id}`,
      headers: { cookie },
      payload: { parentId: child.json().term.id },
    });
    assert.equal(cycle.statusCode, 422);

    const assignment = await app.inject({
      method: 'POST',
      url: '/api/metadata/assignments',
      headers: { cookie },
      payload: {
        taxonomyCode,
        termCode: 'child',
        resourceType: 'example.record',
        resourceId: 'record-1',
      },
    });
    assert.equal(assignment.statusCode, 201);
    const assignments = await app.inject({
      method: 'GET',
      url: '/api/metadata/assignments?resourceType=example.record&resourceId=record-1',
      headers: { cookie },
    });
    assert.equal(assignments.json().items.length, 1);

    const search = await app.inject({
      method: 'GET',
      url: `/api/search?q=${suffix}`,
      headers: { cookie },
    });
    assert.equal(search.statusCode, 200);
    assert.ok(
      search.json().groups.some((group: { source: string }) => group.source === 'dictionaries'),
    );

    const exported = await app.inject({
      method: 'GET',
      url: '/api/data-exchange/datasets/metadata.dictionaries/export',
      headers: { cookie },
    });
    assert.equal(exported.statusCode, 200);
    const preview = await app.inject({
      method: 'POST',
      url: '/api/data-exchange/datasets/metadata.dictionaries/preview',
      headers: { cookie },
      payload: { document: exported.json() },
    });
    assert.equal(preview.statusCode, 200);
    assert.equal(preview.json().preview.valid, true);
    const imported = await app.inject({
      method: 'POST',
      url: '/api/data-exchange/datasets/metadata.dictionaries/import',
      headers: { cookie },
      payload: { document: exported.json() },
    });
    assert.equal(imported.statusCode, 200);
    const runs = await app.inject({
      method: 'GET',
      url: '/api/data-exchange/runs',
      headers: { cookie },
    });
    assert.equal(runs.statusCode, 200);
    assert.ok(runs.json().items.some((run: { direction: string }) => run.direction === 'import'));
    await app.close();
  },
);

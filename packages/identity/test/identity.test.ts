import assert from 'node:assert/strict';
import test from 'node:test';

import { frameIdentityManifest } from '../src/manifest.js';
import { frameIdentityExtension } from '../src/extension.js';
import { identityMigrationSource } from '../src/migrations.js';
import { hashPassword, verifyPassword } from '../src/password.js';
import { hasAnyPermission } from '../src/rbac.js';
import { createNoopIdentityAccountDirectory } from '../src/account-directory.js';

test('Identity manifest is optional and independent from the legacy Frame bundle', () => {
  assert.equal(frameIdentityManifest.id, 'frame-identity');
  assert.deepEqual(frameIdentityManifest.dependencies, undefined);
  assert.ok(frameIdentityManifest.server.routes.some((route) => route.path === '/api/auth/login'));
  assert.equal(frameIdentityExtension.migrations?.source.id, 'frame-identity');
  assert.equal(identityMigrationSource.migrations[0]?.id, '0001_identity.sql');
  assert.match(identityMigrationSource.migrations[0]?.sql ?? '', /CREATE TABLE "accounts"/);
  assert.doesNotMatch(identityMigrationSource.migrations[0]?.sql ?? '', /notification_deliveries/);
});

test('Identity password and RBAC primitives remain self-contained', async () => {
  const hash = await hashPassword('frame-identity-password-2026');
  assert.equal(await verifyPassword('frame-identity-password-2026', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(hasAnyPermission(['owner'], [], ['iam.accounts.write']), true);
});

test('Identity exposes a provider-neutral empty account directory', async () => {
  const directory = createNoopIdentityAccountDirectory();
  assert.equal(directory.configured, false);
  assert.equal(await directory.findById('missing'), null);
  assert.deepEqual(await directory.findByIds(['missing']), []);
  assert.deepEqual(await directory.listActive(), []);
  assert.deepEqual(await directory.search('missing', 10), []);
  assert.deepEqual(await directory.findMatchingIds('missing'), []);
});

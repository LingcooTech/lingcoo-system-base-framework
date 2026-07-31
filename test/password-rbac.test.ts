import assert from 'node:assert/strict';
import test from 'node:test';

import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { hasAnyPermission, hasPermission, isValidRoleCode } from '../src/lib/rbac.js';

test('password hashes are salted and verifiable without storing plaintext', async () => {
  const first = await hashPassword('frame-password-2026');
  const second = await hashPassword('frame-password-2026');

  assert.notEqual(first, second);
  assert.equal(await verifyPassword('frame-password-2026', first), true);
  assert.equal(await verifyPassword('wrong-password', first), false);
  assert.equal(await verifyPassword('frame-password-2026', 'invalid'), false);
});

test('owner receives future permissions while other roles use explicit grants', () => {
  assert.equal(hasPermission(['owner'], [], 'future.module.manage'), true);
  assert.equal(hasPermission(['viewer'], ['system.runtime.read'], 'system.runtime.read'), true);
  assert.equal(hasPermission(['viewer'], ['system.runtime.read'], 'system.settings.write'), false);
  assert.equal(
    hasAnyPermission(
      ['operator'],
      ['integrations.read'],
      ['iam.accounts.write', 'integrations.read'],
    ),
    true,
  );
});

test('role codes stay stable and machine-readable', () => {
  assert.equal(isValidRoleCode('content.editor'), true);
  assert.equal(isValidRoleCode('support-agent'), true);
  assert.equal(isValidRoleCode('Teacher Admin'), false);
  assert.equal(isValidRoleCode('1owner'), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { frameCoreSystem } from '../src/core/extension.js';
import { describeSystemRuntime } from '../src/core/modules/system/index.js';

const application = {
  name: 'Frame Test',
  version: '1.2.3',
  environment: 'test',
};

test('system runtime summary is derived from the installed system manifest and migration ledger', () => {
  const summary = describeSystemRuntime({
    system: frameCoreSystem,
    application,
    appliedMigrationNames: ['frame/0000_base_system.sql'],
  });

  assert.equal(summary.system.id, 'frame-core-system');
  assert.equal(summary.frame.version, frameCoreSystem.frameVersion);
  assert.deepEqual(
    summary.extensions.map((extension) => extension.id),
    ['frame'],
  );
  assert.deepEqual(summary.extensions[0]?.surfaces, [
    'server',
    'worker',
    'migrations',
    'admin',
    'web',
  ]);
  assert.equal(summary.migrations.declaredCount, 10);
  assert.equal(summary.migrations.appliedCount, 1);
  assert.equal(summary.migrations.pendingCount, 9);
  assert.equal(summary.migrations.status, 'pending');
  assert.deepEqual(summary.migrations.sources[0], {
    id: 'frame',
    extensionId: 'frame',
    declaredCount: 10,
    appliedCount: 1,
    pendingCount: 9,
  });
});

test('system runtime summary degrades safely when the migration ledger is unavailable', () => {
  const summary = describeSystemRuntime({
    system: frameCoreSystem,
    application,
    migrationLedgerAvailable: false,
  });

  assert.equal(summary.migrations.status, 'unavailable');
  assert.equal(summary.migrations.ledgerCount, 0);
  assert.equal(summary.migrations.appliedCount, 0);
});

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
    [
      'frame',
      'frame-identity',
      'frame-integrations',
      'frame-jobs',
      'frame-assets',
      'frame-presentation',
      'frame-notifications',
    ],
  );
  assert.deepEqual(summary.extensions[0]?.surfaces, ['server', 'migrations', 'admin']);
  assert.deepEqual(summary.extensions[1]?.surfaces, ['server', 'migrations', 'admin', 'web']);
  assert.deepEqual(summary.extensions[2]?.surfaces, ['server', 'migrations', 'admin']);
  assert.deepEqual(summary.extensions[3]?.surfaces, ['server', 'migrations', 'admin']);
  assert.deepEqual(summary.extensions[4]?.surfaces, ['server', 'worker', 'migrations', 'admin']);
  assert.deepEqual(summary.extensions[5]?.surfaces, ['server', 'migrations', 'admin']);
  assert.deepEqual(summary.extensions[6]?.surfaces, ['server', 'worker', 'migrations', 'admin']);
  assert.equal(summary.migrations.declaredCount, 11);
  assert.equal(summary.migrations.appliedCount, 1);
  assert.equal(summary.migrations.pendingCount, 10);
  assert.equal(summary.migrations.status, 'pending');
  assert.deepEqual(summary.migrations.sources[0], {
    id: 'frame',
    extensionId: 'frame',
    declaredCount: 5,
    appliedCount: 1,
    pendingCount: 4,
  });
  assert.deepEqual(summary.migrations.sources[1], {
    id: 'frame-identity',
    extensionId: 'frame-identity',
    declaredCount: 1,
    appliedCount: 0,
    pendingCount: 1,
  });
  assert.deepEqual(summary.migrations.sources[2], {
    id: 'frame-integrations',
    extensionId: 'frame-integrations',
    declaredCount: 1,
    appliedCount: 0,
    pendingCount: 1,
  });
  assert.deepEqual(summary.migrations.sources[3], {
    id: 'frame-jobs',
    extensionId: 'frame-jobs',
    declaredCount: 1,
    appliedCount: 0,
    pendingCount: 1,
  });
  assert.deepEqual(summary.migrations.sources[4], {
    id: 'frame-assets',
    extensionId: 'frame-assets',
    declaredCount: 1,
    appliedCount: 0,
    pendingCount: 1,
  });
  assert.deepEqual(summary.migrations.sources[5], {
    id: 'frame-presentation',
    extensionId: 'frame-presentation',
    declaredCount: 1,
    appliedCount: 0,
    pendingCount: 1,
  });
  assert.deepEqual(summary.migrations.sources[6], {
    id: 'frame-notifications',
    extensionId: 'frame-notifications',
    declaredCount: 1,
    appliedCount: 0,
    pendingCount: 1,
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

import assert from 'node:assert/strict';
import test from 'node:test';

import { frameJobsExtension, frameJobsManifest, jobsMigrationSource } from '../src/index.js';
import { computeBackoffMs, JobHandlerRegistry } from '../src/worker.js';

test('Jobs owns its server, worker contracts and migration source', async () => {
  assert.equal(frameJobsManifest.id, 'frame-jobs');
  assert.equal(frameJobsExtension.migrations?.source.id, 'frame-jobs');
  assert.match(jobsMigrationSource.migrations[0]?.sql ?? '', /CREATE TABLE "job_runs"/);
  assert.match(jobsMigrationSource.migrations[0]?.sql ?? '', /CREATE TABLE "outbox_events"/);
  assert.doesNotMatch(jobsMigrationSource.migrations[0]?.sql ?? '', /CREATE TABLE "notifications"/);

  const registry = new JobHandlerRegistry();
  registry.register('test.run', async () => ({ ok: true }));
  assert.deepEqual(
    await registry.execute('test.run', {
      jobId: '1',
      payload: {},
      signal: new AbortController().signal,
    }),
    { ok: true },
  );
  assert.equal(computeBackoffMs(1), 5_000);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { loadEnv } from '../src/host/env.js';

test('worker runtime import is side-effect free and idle instances can be disposed', async () => {
  const signalListeners = {
    SIGINT: process.listenerCount('SIGINT'),
    SIGTERM: process.listenerCount('SIGTERM'),
  };
  const { createFrameWorker } = await import('../src/runtime/worker.js');

  assert.equal(process.listenerCount('SIGINT'), signalListeners.SIGINT);
  assert.equal(process.listenerCount('SIGTERM'), signalListeners.SIGTERM);

  const worker = createFrameWorker(
    loadEnv({
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgres://frame:frame@127.0.0.1:1/frame_worker_test',
      AUTH_JWT_SECRET: 'frame-worker-test-secret-at-least-32-characters',
    }),
  );

  assert.equal(worker.getStatus().state, 'idle');
  assert.deepEqual(worker.getStatus().extensions, []);
  assert.deepEqual(worker.getStatus().jobKinds, []);
  assert.deepEqual(worker.getStatus().eventTopics, []);
  await worker.dispose();
  assert.equal(worker.getStatus().state, 'stopped');
});

test('empty Kernel worker starts and stops without connecting to PostgreSQL', async () => {
  const { createFrameWorker } = await import('../src/runtime/worker.js');
  const worker = createFrameWorker(
    loadEnv({
      NODE_ENV: 'test',
      API_HOST: '127.0.0.1',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgres://frame:frame@127.0.0.1:1/unreachable',
      WORKER_POLL_INTERVAL_MS: '100',
    }),
    { healthServer: false },
  );

  const completion = worker.run();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(worker.getStatus().state, 'running');
  await worker.stop('test');
  await completion;
  assert.equal(worker.getStatus().state, 'stopped');
});

test('empty Kernel migration plan completes without connecting to PostgreSQL', async () => {
  const { runSystemMigrations } = await import('../src/runtime/migrations.js');
  const messages: string[] = [];
  const result = await runSystemMigrations({
    connectionString: 'postgres://frame:frame@127.0.0.1:1/unreachable',
    logger: { log: (message) => messages.push(message) },
  });

  assert.deepEqual(result, { applied: [], adopted: [], alreadyApplied: [] });
  assert.deepEqual(messages, ['No migrations found; skipping.']);
});

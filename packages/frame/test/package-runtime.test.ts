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
  await worker.dispose();
  assert.equal(worker.getStatus().state, 'stopped');
});

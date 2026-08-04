#!/usr/bin/env node

import { loadEnv } from './lib/env.js';
import { createFrameWorker } from './runtime/worker.js';

const worker = createFrameWorker(loadEnv());

process.on('SIGTERM', () => void worker.stop('SIGTERM'));
process.on('SIGINT', () => void worker.stop('SIGINT'));

try {
  await worker.run();
} catch {
  process.exitCode = 1;
}

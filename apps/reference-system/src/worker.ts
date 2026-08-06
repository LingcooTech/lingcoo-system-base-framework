#!/usr/bin/env node

import { createFrameWorker, loadEnv } from '@lingcoo/frame';

import { referenceSystem } from './system.js';

const worker = createFrameWorker(loadEnv(), { system: referenceSystem });

process.on('SIGTERM', () => void worker.stop('SIGTERM'));
process.on('SIGINT', () => void worker.stop('SIGINT'));

try {
  await worker.run();
} catch {
  process.exitCode = 1;
}

import { defineExtension } from '@lingcootech/frame-extension-sdk';

import { frameJobsManifest } from './manifest.js';
import { jobsMigrationExtension } from './migrations.js';
import type { JobsPorts } from './ports.js';
import { createJobsServerExtension, type JobsPortsFactory } from './server.js';

export function createJobsExtension(
  options: {
    ports?: JobsPorts | JobsPortsFactory;
  } = {},
) {
  return defineExtension({
    manifest: frameJobsManifest,
    server: createJobsServerExtension(options),
    migrations: jobsMigrationExtension,
  });
}

export const frameJobsExtension = createJobsExtension();

import { defineExtension } from '@lingcootech/frame-extension-sdk';

import { domainManifest } from './contracts.js';
import { domainMigrationExtension } from './migrations.js';
import { domainServerExtension } from './server.js';
import { domainWorkerExtension } from './worker.js';

export const domainExtension = defineExtension({
  manifest: domainManifest,
  server: domainServerExtension,
  worker: domainWorkerExtension,
  migrations: domainMigrationExtension,
});

export { domainManifest } from './contracts.js';

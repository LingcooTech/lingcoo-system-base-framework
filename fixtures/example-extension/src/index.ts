import { defineExtension } from '@lingcoo/frame-extension-sdk';

import { exampleManifest } from './contracts.js';
import { exampleMigrationExtension } from './migrations.js';
import { exampleServerExtension } from './server.js';
import { exampleWorkerExtension } from './worker.js';

export const exampleExtension = defineExtension({
  manifest: exampleManifest,
  server: exampleServerExtension,
  worker: exampleWorkerExtension,
  migrations: exampleMigrationExtension,
});

export { exampleManifest } from './contracts.js';
export { exampleMigrationExtension, exampleMigrationSource } from './migrations.js';
export { exampleServerExtension } from './server.js';
export { exampleWorkerExtension } from './worker.js';

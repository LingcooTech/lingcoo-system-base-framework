import { readFileSync } from 'node:fs';

import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';

export const domainMigrationSource = defineMigrationSource({
  id: '__SYSTEM_ID__-domain',
  version: '0.1.0',
  dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
  migrations: [
    {
      id: '0001_initial.sql',
      sql: readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'),
    },
  ],
});

export const domainMigrationExtension = defineMigrationExtension(domainMigrationSource);

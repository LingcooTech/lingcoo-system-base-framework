import { readFileSync } from 'node:fs';
import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';

export const integrationsMigrationSource = defineMigrationSource({
  id: 'frame-integrations',
  version: FRAME_VERSION,
  dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
  migrations: [
    {
      id: '0001_integrations.sql',
      sql: readFileSync(new URL('../migrations/0001_integrations.sql', import.meta.url), 'utf8'),
    },
  ],
});

export const integrationsMigrationExtension = defineMigrationExtension(integrationsMigrationSource);

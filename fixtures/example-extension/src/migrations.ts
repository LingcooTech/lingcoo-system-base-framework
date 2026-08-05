import { readFileSync } from 'node:fs';

import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcoo/frame-extension-sdk/migrations';

export const exampleMigrationSource = defineMigrationSource({
  id: 'example',
  version: '0.1.0',
  dependencies: [{ id: 'frame', version: '^0.5.0' }],
  migrations: [
    {
      id: '0001_initial.sql',
      sql: readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'),
      legacyAliases: ['0001_example_initial.sql'],
    },
  ],
});

export const exampleMigrationExtension = defineMigrationExtension(exampleMigrationSource);

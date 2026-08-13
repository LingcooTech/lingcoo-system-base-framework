import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';
import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const identityMigrationsDirectory = path.join(packageDirectory, 'migrations');

export const identityMigrationSource = defineMigrationSource({
  id: 'frame-identity',
  version: FRAME_VERSION,
  migrations: [
    {
      id: '0001_identity.sql',
      sql: readFileSync(path.join(identityMigrationsDirectory, '0001_identity.sql'), 'utf8'),
    },
  ],
});

export const identityMigrationExtension = defineMigrationExtension(identityMigrationSource);

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const assetsMigrationsDirectory = path.join(packageDirectory, 'migrations');

export const assetsMigrationSource = defineMigrationSource({
  id: 'frame-assets',
  version: FRAME_VERSION,
  dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
  migrations: [
    {
      id: '0001_assets.sql',
      sql: readFileSync(path.join(assetsMigrationsDirectory, '0001_assets.sql'), 'utf8'),
    },
  ],
});

export const assetsMigrationExtension = defineMigrationExtension(assetsMigrationSource);

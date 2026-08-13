import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';
import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const presentationMigrationSource = defineMigrationSource({
  id: 'frame-presentation',
  version: FRAME_VERSION,
  dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
  migrations: [
    {
      id: '0001_presentation.sql',
      sql: readFileSync(path.join(directory, 'migrations/0001_presentation.sql'), 'utf8'),
      legacyAliases: ['0008_presentation.sql', 'frame/0008_presentation.sql'],
    },
  ],
});
export const presentationMigrationExtension = defineMigrationExtension(presentationMigrationSource);

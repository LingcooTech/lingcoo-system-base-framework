import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const jobsMigrationsDirectory = path.join(packageDirectory, 'migrations');

export const jobsMigrationSource = defineMigrationSource({
  id: 'frame-jobs',
  version: FRAME_VERSION,
  dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
  migrations: [
    {
      id: '0001_jobs.sql',
      sql: readFileSync(path.join(jobsMigrationsDirectory, '0001_jobs.sql'), 'utf8'),
    },
  ],
});

export const jobsMigrationExtension = defineMigrationExtension(jobsMigrationSource);

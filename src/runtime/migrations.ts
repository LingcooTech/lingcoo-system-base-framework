import type { DefinedSystem } from '@lingcoo/frame-extension-sdk';
import {
  runMigrations,
  type MigrationLogger,
  type MigrationResult,
} from '@lingcoo/frame-database/migrations';

import { defaultFrameSystem } from '../extensions/core.js';
import { assertFrameSystemCompatibility, collectSystemMigrationSources } from './extensions.js';

export interface RunSystemMigrationsOptions {
  connectionString: string;
  system?: DefinedSystem;
  logger?: MigrationLogger;
}

export function runSystemMigrations({
  connectionString,
  system = defaultFrameSystem,
  logger,
}: RunSystemMigrationsOptions): Promise<MigrationResult> {
  assertFrameSystemCompatibility(system);
  return runMigrations({
    connectionString,
    sources: collectSystemMigrationSources(system),
    logger,
  });
}

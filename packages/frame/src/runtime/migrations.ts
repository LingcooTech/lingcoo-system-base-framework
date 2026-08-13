import type { DefinedSystem } from '@lingcootech/frame-extension-sdk';
import {
  runMigrations,
  type MigrationLogger,
  type MigrationResult,
} from '@lingcootech/frame-database/migrations';

import { frameKernelSystem } from '../kernel/system.js';
import { assertFrameSystemCompatibility, collectSystemMigrationSources } from './extensions.js';

export interface RunSystemMigrationsOptions {
  connectionString: string;
  system?: DefinedSystem;
  logger?: MigrationLogger;
}

export function runSystemMigrations({
  connectionString,
  system = frameKernelSystem,
  logger,
}: RunSystemMigrationsOptions): Promise<MigrationResult> {
  assertFrameSystemCompatibility(system);
  return runMigrations({
    connectionString,
    sources: collectSystemMigrationSources(system),
    logger,
  });
}

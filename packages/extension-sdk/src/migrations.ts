export {
  defineMigrationSource,
  type Migration,
  type MigrationSource,
  type MigrationSourceDependency,
} from '@lingcootech/frame-database/migrations';

import type { MigrationSource } from '@lingcootech/frame-database/migrations';

export interface MigrationExtensionSurface {
  source: MigrationSource;
}

export function defineMigrationExtension(source: MigrationSource): MigrationExtensionSurface {
  return { source };
}

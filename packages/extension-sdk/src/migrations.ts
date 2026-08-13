/**
 * Storage-neutral migration contracts. Infrastructure adapters execute these
 * sources, but extension manifests must not depend on a PostgreSQL package.
 */
export interface MigrationSourceDependency {
  id: string;
  version: string;
}

export interface Migration {
  id: string;
  sql: string;
  checksum?: string;
  legacyAliases?: readonly string[];
}

export interface MigrationSource {
  id: string;
  version: string;
  dependencies?: readonly MigrationSourceDependency[];
  migrations: readonly Migration[];
}

export function defineMigrationSource<T extends MigrationSource>(source: T): T {
  return source;
}

export interface MigrationExtensionSurface {
  source: MigrationSource;
}

export function defineMigrationExtension(source: MigrationSource): MigrationExtensionSurface {
  return { source };
}

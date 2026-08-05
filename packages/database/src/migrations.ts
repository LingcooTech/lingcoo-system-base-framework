import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import semver from 'semver';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceIdPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const migrationIdPattern = /^[a-z0-9][a-z0-9._-]*\.sql$/;
const frameMigrationFiles = [
  '0000_base_system.sql',
  '0001_identity_access.sql',
  '0002_integration_foundation.sql',
  '0003_jobs_notifications.sql',
  '0004_storage_assets.sql',
  '0005_governance.sql',
  '0006_metadata_exchange.sql',
  '0007_observability.sql',
  '0008_presentation.sql',
  '0010_account_security.sql',
] as const;

export const frameMigrationsDirectory = path.join(packageDirectory, 'drizzle');
export const FRAME_DATABASE_VERSION = '0.5.0';

export interface MigrationLogger {
  log(message: string): void;
}

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

export interface CompiledMigration {
  sourceId: string;
  id: string;
  canonicalId: string;
  sql: string;
  checksum: string;
  legacyAliases: readonly string[];
}

export interface RunMigrationsOptions {
  connectionString: string;
  sources?: readonly MigrationSource[];
  migrationsDirectory?: string;
  logger?: MigrationLogger;
}

export interface MigrationResult {
  applied: string[];
  adopted: string[];
  alreadyApplied: string[];
}

export function calculateMigrationChecksum(sql: string): string {
  return createHash('sha256').update(sql).digest('hex');
}

export function listMigrationFiles(migrationsDirectory = frameMigrationsDirectory): string[] {
  if (!existsSync(migrationsDirectory)) return [];
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

export function createFileMigrationSource(options: {
  id: string;
  version: string;
  directory: string;
  files?: readonly string[];
  dependencies?: readonly MigrationSourceDependency[];
  legacyAliases?: Readonly<Record<string, readonly string[]>>;
}): MigrationSource {
  const files = options.files ?? listMigrationFiles(options.directory);
  return defineMigrationSource({
    id: options.id,
    version: options.version,
    dependencies: options.dependencies,
    migrations: files.map((id) => ({
      id,
      sql: readFileSync(path.join(options.directory, id), 'utf8'),
      legacyAliases: options.legacyAliases?.[id],
    })),
  });
}

export const frameMigrationSource = createFileMigrationSource({
  id: 'frame',
  version: FRAME_DATABASE_VERSION,
  directory: frameMigrationsDirectory,
  files: frameMigrationFiles,
  legacyAliases: Object.fromEntries(frameMigrationFiles.map((file) => [file, [file]])),
});

export function defineMigrationSource<T extends MigrationSource>(source: T): T {
  return source;
}

function migrationError(message: string): never {
  throw new Error(`Invalid migration sources: ${message}`);
}

export function compileMigrationPlan(sources: readonly MigrationSource[]): CompiledMigration[] {
  const byId = new Map<string, MigrationSource>();
  const inputOrder = new Map<string, number>();
  const canonicalClaims = new Map<string, string>();
  const aliasClaims = new Map<string, string>();

  for (const [index, source] of sources.entries()) {
    if (!sourceIdPattern.test(source.id)) migrationError(`invalid source id ${source.id}`);
    if (!semver.valid(source.version)) {
      migrationError(`invalid version ${source.version} for source ${source.id}`);
    }
    if (byId.has(source.id)) migrationError(`duplicate source id ${source.id}`);
    byId.set(source.id, source);
    inputOrder.set(source.id, index);

    const dependencyIds = new Set<string>();
    for (const dependency of source.dependencies ?? []) {
      if (!sourceIdPattern.test(dependency.id)) {
        migrationError(`invalid dependency id ${dependency.id} in source ${source.id}`);
      }
      if (!semver.validRange(dependency.version)) {
        migrationError(`invalid dependency range ${dependency.version} in source ${source.id}`);
      }
      if (dependency.id === source.id)
        migrationError(`source ${source.id} cannot depend on itself`);
      if (dependencyIds.has(dependency.id)) {
        migrationError(`duplicate dependency ${dependency.id} in source ${source.id}`);
      }
      dependencyIds.add(dependency.id);
    }

    for (const migration of source.migrations) {
      if (!migrationIdPattern.test(migration.id) || migration.id.includes('/')) {
        migrationError(`invalid migration id ${migration.id} in source ${source.id}`);
      }
      const canonicalId = `${source.id}/${migration.id}`;
      const canonicalOwner = canonicalClaims.get(canonicalId);
      if (canonicalOwner) migrationError(`duplicate migration ${canonicalId}`);
      canonicalClaims.set(canonicalId, source.id);
      const calculated = calculateMigrationChecksum(migration.sql);
      if (migration.checksum && migration.checksum !== calculated) {
        migrationError(`declared checksum does not match ${canonicalId}`);
      }
      for (const alias of migration.legacyAliases ?? []) {
        const parts = alias.split('/');
        if (
          !alias ||
          alias.includes('\\') ||
          parts.length > 2 ||
          (parts.length === 2 &&
            (!sourceIdPattern.test(parts[0]!) || !migrationIdPattern.test(parts[1]!)))
        ) {
          migrationError(`invalid Legacy Alias ${alias} for ${canonicalId}`);
        }
        const aliasOwner = aliasClaims.get(alias);
        if (aliasOwner) {
          migrationError(`Legacy Alias ${alias} is claimed by ${aliasOwner} and ${canonicalId}`);
        }
        aliasClaims.set(alias, canonicalId);
      }
    }
  }

  for (const [alias, owner] of aliasClaims) {
    if (canonicalClaims.has(alias)) {
      migrationError(`Legacy Alias ${alias} for ${owner} conflicts with a canonical migration`);
    }
  }

  const outgoing = new Map<string, string[]>();
  const indegree = new Map(sources.map((source) => [source.id, 0]));
  for (const source of sources) {
    for (const dependency of source.dependencies ?? []) {
      const installed = byId.get(dependency.id);
      if (!installed) migrationError(`source ${source.id} is missing dependency ${dependency.id}`);
      if (!semver.satisfies(installed.version, dependency.version)) {
        migrationError(
          `source ${source.id} requires ${dependency.id} ${dependency.version}, installed version is ${installed.version}`,
        );
      }
      outgoing.set(dependency.id, [...(outgoing.get(dependency.id) ?? []), source.id]);
      indegree.set(source.id, indegree.get(source.id)! + 1);
    }
  }

  const ready = sources
    .filter((source) => indegree.get(source.id) === 0)
    .map((source) => source.id);
  const sorted: MigrationSource[] = [];
  while (ready.length > 0) {
    ready.sort((left, right) => inputOrder.get(left)! - inputOrder.get(right)!);
    const id = ready.shift()!;
    sorted.push(byId.get(id)!);
    for (const consumer of outgoing.get(id) ?? []) {
      const remaining = indegree.get(consumer)! - 1;
      indegree.set(consumer, remaining);
      if (remaining === 0) ready.push(consumer);
    }
  }
  if (sorted.length !== sources.length) {
    const cycle = sources
      .filter((source) => indegree.get(source.id)! > 0)
      .map((source) => source.id);
    migrationError(`dependency cycle detected: ${cycle.join(', ')}`);
  }

  return sorted.flatMap((source) =>
    source.migrations.map((migration) => ({
      sourceId: source.id,
      id: migration.id,
      canonicalId: `${source.id}/${migration.id}`,
      sql: migration.sql,
      checksum: calculateMigrationChecksum(migration.sql),
      legacyAliases: Object.freeze([...(migration.legacyAliases ?? [])]),
    })),
  );
}

export async function runMigrations({
  connectionString,
  sources,
  migrationsDirectory,
  logger = console,
}: RunMigrationsOptions): Promise<MigrationResult> {
  if (sources && migrationsDirectory) {
    throw new Error('Provide migration sources or migrationsDirectory, not both');
  }
  const resolvedSources = sources ?? [
    migrationsDirectory
      ? createFileMigrationSource({
          id: 'frame',
          version: FRAME_DATABASE_VERSION,
          directory: migrationsDirectory,
          legacyAliases: Object.fromEntries(
            listMigrationFiles(migrationsDirectory).map((file) => [file, [file]]),
          ),
        })
      : frameMigrationSource,
  ];
  const plan = compileMigrationPlan(resolvedSources);
  const result: MigrationResult = { applied: [], adopted: [], alreadyApplied: [] };

  if (plan.length === 0) {
    logger.log('No migrations found; skipping.');
    return result;
  }

  const pool = new pg.Pool({ connectionString });
  try {
    const client = await pool.connect();
    let migrationLockHeld = false;
    try {
      await client.query("SELECT pg_advisory_lock(hashtext('lingcoo.frame.migrations'))");
      migrationLockHeld = true;
      await client.query(`
        CREATE TABLE IF NOT EXISTS framework_migrations (
          name text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      for (const migration of plan) {
        const existing = await client.query<{ checksum: string }>(
          'SELECT checksum FROM framework_migrations WHERE name = $1',
          [migration.canonicalId],
        );
        if (existing.rowCount === 1) {
          if (existing.rows[0].checksum !== migration.checksum) {
            throw new Error(`Migration ${migration.canonicalId} changed after it was applied`);
          }
          result.alreadyApplied.push(migration.canonicalId);
          logger.log(`Already applied: ${migration.canonicalId}`);
          continue;
        }

        const aliases = migration.legacyAliases;
        const legacy = aliases.length
          ? await client.query<{ name: string; checksum: string }>(
              'SELECT name, checksum FROM framework_migrations WHERE name = ANY($1::text[])',
              [aliases],
            )
          : { rowCount: 0, rows: [] as { name: string; checksum: string }[] };
        if ((legacy.rowCount ?? 0) > 1) {
          throw new Error(`Migration ${migration.canonicalId} has multiple applied Legacy Aliases`);
        }
        if (legacy.rowCount === 1) {
          const alias = legacy.rows[0];
          if (alias.checksum !== migration.checksum) {
            throw new Error(
              `Legacy Alias ${alias.name} checksum does not match ${migration.canonicalId}`,
            );
          }
          await client.query('BEGIN');
          try {
            await client.query(
              'INSERT INTO framework_migrations (name, checksum) VALUES ($1, $2)',
              [migration.canonicalId, migration.checksum],
            );
            await client.query('COMMIT');
          } catch (error) {
            await client.query('ROLLBACK');
            throw error;
          }
          result.adopted.push(migration.canonicalId);
          logger.log(`Adopted: ${migration.canonicalId} from ${alias.name}`);
          continue;
        }

        await client.query('BEGIN');
        try {
          await client.query(migration.sql);
          await client.query('INSERT INTO framework_migrations (name, checksum) VALUES ($1, $2)', [
            migration.canonicalId,
            migration.checksum,
          ]);
          await client.query('COMMIT');
          result.applied.push(migration.canonicalId);
          logger.log(`Applied: ${migration.canonicalId}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      logger.log('Database migrations complete.');
      return result;
    } finally {
      if (migrationLockHeld) {
        await client
          .query("SELECT pg_advisory_unlock(hashtext('lingcoo.frame.migrations'))")
          .catch(() => undefined);
      }
      client.release();
    }
  } finally {
    await pool.end();
  }
}

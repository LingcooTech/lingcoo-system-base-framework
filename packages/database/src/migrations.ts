import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const frameMigrationsDirectory = path.join(packageDirectory, 'drizzle');

export interface MigrationLogger {
  log(message: string): void;
}

export interface RunMigrationsOptions {
  connectionString: string;
  migrationsDirectory?: string;
  logger?: MigrationLogger;
}

export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

export function listMigrationFiles(migrationsDirectory = frameMigrationsDirectory): string[] {
  if (!existsSync(migrationsDirectory)) return [];
  return readdirSync(migrationsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();
}

export async function runMigrations({
  connectionString,
  migrationsDirectory = frameMigrationsDirectory,
  logger = console,
}: RunMigrationsOptions): Promise<MigrationResult> {
  const migrationFiles = listMigrationFiles(migrationsDirectory);
  const result: MigrationResult = { applied: [], alreadyApplied: [] };

  if (migrationFiles.length === 0) {
    logger.log('No migrations found; skipping.');
    return result;
  }

  const pool = new pg.Pool({ connectionString });
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS framework_migrations (
          name text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      `);

      for (const fileName of migrationFiles) {
        const migration = readFileSync(path.join(migrationsDirectory, fileName), 'utf8');
        const checksum = createHash('sha256').update(migration).digest('hex');
        const existing = await client.query(
          'SELECT checksum FROM framework_migrations WHERE name = $1',
          [fileName],
        );

        if (existing.rowCount === 1) {
          if (existing.rows[0].checksum !== checksum) {
            throw new Error(`Migration ${fileName} changed after it was applied`);
          }
          result.alreadyApplied.push(fileName);
          logger.log(`Already applied: ${fileName}`);
          continue;
        }

        await client.query('BEGIN');
        try {
          await client.query(migration);
          await client.query('INSERT INTO framework_migrations (name, checksum) VALUES ($1, $2)', [
            fileName,
            checksum,
          ]);
          await client.query('COMMIT');
          result.applied.push(fileName);
          logger.log(`Applied: ${fileName}`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }

      logger.log('Database migrations complete.');
      return result;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

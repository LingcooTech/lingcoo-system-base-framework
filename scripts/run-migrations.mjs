import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const migrationsFolder = path.resolve('drizzle');
const migrationFiles = existsSync(migrationsFolder)
  ? readdirSync(migrationsFolder, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
      .map((entry) => entry.name)
      .sort()
  : [];

if (migrationFiles.length === 0) {
  console.log('No migrations found; skipping.');
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
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
      const migration = readFileSync(path.join(migrationsFolder, fileName), 'utf8');
      const checksum = createHash('sha256').update(migration).digest('hex');
      const existing = await client.query(
        'SELECT checksum FROM framework_migrations WHERE name = $1',
        [fileName],
      );

      if (existing.rowCount === 1) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${fileName} changed after it was applied`);
        }
        console.log(`Already applied: ${fileName}`);
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
        console.log(`Applied: ${fileName}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }

    console.log('Database migrations complete.');
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

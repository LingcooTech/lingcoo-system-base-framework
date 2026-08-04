import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import pg from 'pg';

import {
  calculateMigrationChecksum,
  compileMigrationPlan,
  defineMigrationSource,
  frameMigrationSource,
  runMigrations,
} from '@lingcoo/frame-database/migrations';

test('Migration V2 preserves manifest order and sorts source dependencies', () => {
  const base = defineMigrationSource({
    id: 'base',
    version: '1.0.0',
    migrations: [
      { id: '0002_second.sql', sql: 'SELECT 2' },
      { id: '0001_first.sql', sql: 'SELECT 1' },
    ],
  });
  const domain = defineMigrationSource({
    id: 'domain',
    version: '1.0.0',
    dependencies: [{ id: 'base', version: '^1.0.0' }],
    migrations: [{ id: '0001_domain.sql', sql: 'SELECT 3' }],
  });
  const plan = compileMigrationPlan([domain, base]);
  assert.deepEqual(
    plan.map((migration) => migration.canonicalId),
    ['base/0002_second.sql', 'base/0001_first.sql', 'domain/0001_domain.sql'],
  );
});

test('Migration V2 rejects duplicate aliases, changed checksums and dependency cycles', () => {
  assert.throws(
    () =>
      compileMigrationPlan([
        {
          id: 'alpha',
          version: '1.0.0',
          migrations: [{ id: '0001_alpha.sql', sql: 'SELECT 1', legacyAliases: ['0001_old.sql'] }],
        },
        {
          id: 'beta',
          version: '1.0.0',
          migrations: [{ id: '0001_beta.sql', sql: 'SELECT 2', legacyAliases: ['0001_old.sql'] }],
        },
      ]),
    /Legacy Alias .* is claimed/,
  );
  assert.throws(
    () =>
      compileMigrationPlan([
        {
          id: 'alpha',
          version: '1.0.0',
          migrations: [{ id: '0001_alpha.sql', sql: 'SELECT 1', checksum: 'changed' }],
        },
      ]),
    /declared checksum does not match/,
  );
  assert.throws(
    () =>
      compileMigrationPlan([
        {
          id: 'alpha',
          version: '1.0.0',
          dependencies: [{ id: 'beta', version: '*' }],
          migrations: [],
        },
        {
          id: 'beta',
          version: '1.0.0',
          dependencies: [{ id: 'alpha', version: '*' }],
          migrations: [],
        },
      ]),
    /dependency cycle/,
  );
});

test('Frame migrations expose canonical IDs and immutable historical aliases', () => {
  const plan = compileMigrationPlan([frameMigrationSource]);
  assert.equal(plan.length, 12);
  assert.equal(plan[0].canonicalId, 'frame/0000_base_system.sql');
  assert.deepEqual(plan[0].legacyAliases, ['0000_base_system.sql']);
  assert.equal(plan.at(-1)?.canonicalId, 'frame/0011_cms_workflow.sql');
});

const databaseUrl = process.env.DATABASE_URL;

test(
  'Migration V2 adopts a matching legacy record without replaying SQL',
  { skip: !databaseUrl },
  async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const sourceId = `adoption-${suffix}`;
    const alias = `legacy_${suffix}.sql`;
    const sql = `SELECT '${suffix}'`;
    const checksum = calculateMigrationChecksum(sql);
    const pool = new pg.Pool({ connectionString: databaseUrl });
    await pool.query('INSERT INTO framework_migrations (name, checksum) VALUES ($1, $2)', [
      alias,
      checksum,
    ]);
    await pool.end();

    const result = await runMigrations({
      connectionString: databaseUrl!,
      sources: [
        {
          id: sourceId,
          version: '1.0.0',
          migrations: [{ id: '0001_adopt.sql', sql, legacyAliases: [alias] }],
        },
      ],
      logger: { log() {} },
    });
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.adopted, [`${sourceId}/0001_adopt.sql`]);

    const verificationPool = new pg.Pool({ connectionString: databaseUrl });
    const canonical = await verificationPool.query(
      'SELECT checksum FROM framework_migrations WHERE name = $1',
      [`${sourceId}/0001_adopt.sql`],
    );
    await verificationPool.end();
    assert.equal(canonical.rows[0]?.checksum, checksum);
  },
);

test(
  'Migration V2 refuses a Legacy Alias with a mismatched checksum',
  { skip: !databaseUrl },
  async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const sourceId = `mismatch-${suffix}`;
    const alias = `legacy_${suffix}.sql`;
    const pool = new pg.Pool({ connectionString: databaseUrl });
    await pool.query('INSERT INTO framework_migrations (name, checksum) VALUES ($1, $2)', [
      alias,
      calculateMigrationChecksum('different SQL'),
    ]);
    await pool.end();

    await assert.rejects(
      () =>
        runMigrations({
          connectionString: databaseUrl!,
          sources: [
            {
              id: sourceId,
              version: '1.0.0',
              migrations: [{ id: '0001_mismatch.sql', sql: 'SELECT 1', legacyAliases: [alias] }],
            },
          ],
          logger: { log() {} },
        }),
      /Legacy Alias .* checksum does not match/,
    );
  },
);

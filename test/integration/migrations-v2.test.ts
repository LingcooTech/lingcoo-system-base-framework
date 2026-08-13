import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import pg from 'pg';

import { assetsMigrationSource } from '@lingcootech/frame-assets';
import { presentationMigrationSource } from '@lingcootech/frame-presentation/migrations';
import {
  calculateMigrationChecksum,
  compileMigrationPlan,
  defineMigrationSource,
  frameMigrationSource,
  runMigrations,
} from '@lingcootech/frame-database/migrations';
import { cmsMigrationSource } from '@lingcootech/frame-cms/migrations';
import { identityMigrationSource } from '@lingcootech/frame-identity/migrations';
import { integrationsMigrationSource } from '@lingcootech/frame-integrations/migrations';
import { jobsMigrationSource } from '@lingcootech/frame-jobs/migrations';
import { notificationsMigrationSource } from '@lingcootech/frame-notifications/migrations';

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

test('Feature migration sources expose canonical ownership and platform aliases', () => {
  const plan = compileMigrationPlan([
    frameMigrationSource,
    identityMigrationSource,
    assetsMigrationSource,
    presentationMigrationSource,
    integrationsMigrationSource,
    jobsMigrationSource,
    notificationsMigrationSource,
  ]);
  assert.equal(plan.length, 11);
  assert.equal(plan[0].canonicalId, 'frame-identity/0001_identity.sql');
  assert.deepEqual(plan[0].legacyAliases, []);
  assert.equal(plan[1].canonicalId, 'frame/0000_base_system.sql');
  assert.deepEqual(plan[1].legacyAliases, ['0000_base_system.sql']);
  assert.ok(plan.some((migration) => migration.canonicalId === 'frame-assets/0001_assets.sql'));
  assert.ok(
    plan.some((migration) => migration.canonicalId === 'frame-presentation/0001_presentation.sql'),
  );
  assert.ok(
    plan.some((migration) => migration.canonicalId === 'frame-integrations/0001_integrations.sql'),
  );
  assert.ok(plan.some((migration) => migration.canonicalId === 'frame-jobs/0001_jobs.sql'));
  assert.ok(
    plan.some(
      (migration) => migration.canonicalId === 'frame-notifications/0001_notifications.sql',
    ),
  );
  assert.ok(
    plan.some((migration) => migration.canonicalId === 'frame-presentation/0001_presentation.sql'),
  );

  const systemPlan = compileMigrationPlan([
    cmsMigrationSource,
    frameMigrationSource,
    identityMigrationSource,
    assetsMigrationSource,
    presentationMigrationSource,
    integrationsMigrationSource,
    jobsMigrationSource,
    notificationsMigrationSource,
  ]);
  assert.equal(systemPlan.length, 13);
  const cmsInitial = systemPlan.find(
    (migration) => migration.canonicalId === 'frame-cms/0009_cms_lite.sql',
  );
  assert.ok(cmsInitial);
  assert.deepEqual(cmsInitial.legacyAliases, ['0009_cms_lite.sql', 'frame/0009_cms_lite.sql']);
  assert.ok(
    systemPlan.some((migration) => migration.canonicalId === 'frame-cms/0011_cms_workflow.sql'),
  );
});

const databaseUrl = process.env.DATABASE_URL;

test(
  'Migration V2 adopts matching legacy records without replaying SQL',
  { skip: !databaseUrl },
  async () => {
    const suffix = randomUUID().replaceAll('-', '');
    const sourceId = `adoption-${suffix}`;
    const aliases = [`legacy-${suffix}/0001_previous.sql`, `0001_${suffix}.sql`];
    const sql = `SELECT '${suffix}'`;
    const checksum = calculateMigrationChecksum(sql);
    const pool = new pg.Pool({ connectionString: databaseUrl });
    for (const alias of aliases) {
      await pool.query('INSERT INTO framework_migrations (name, checksum) VALUES ($1, $2)', [
        alias,
        checksum,
      ]);
    }
    await pool.end();

    const result = await runMigrations({
      connectionString: databaseUrl!,
      sources: [
        {
          id: sourceId,
          version: '1.0.0',
          migrations: [{ id: '0001_adopt.sql', sql, legacyAliases: aliases }],
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
    const matchingAlias = `matching_${suffix}.sql`;
    const mismatchedAlias = `mismatched_${suffix}.sql`;
    const sql = 'SELECT 1';
    const pool = new pg.Pool({ connectionString: databaseUrl });
    await pool.query(
      'INSERT INTO framework_migrations (name, checksum) VALUES ($1, $2), ($3, $4)',
      [
        matchingAlias,
        calculateMigrationChecksum(sql),
        mismatchedAlias,
        calculateMigrationChecksum('different SQL'),
      ],
    );
    await pool.end();

    await assert.rejects(
      () =>
        runMigrations({
          connectionString: databaseUrl!,
          sources: [
            {
              id: sourceId,
              version: '1.0.0',
              migrations: [
                {
                  id: '0001_mismatch.sql',
                  sql,
                  legacyAliases: [matchingAlias, mismatchedAlias],
                },
              ],
            },
          ],
          logger: { log() {} },
        }),
      /Legacy Alias .* checksum does not match/,
    );
  },
);

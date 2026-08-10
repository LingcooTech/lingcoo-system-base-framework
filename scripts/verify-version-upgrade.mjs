import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { frameCoreExtension, runSystemMigrations } from '@lingcootech/frame';
import { frameCmsExtension } from '@lingcootech/frame/cms';
import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';
import pg from 'pg';

const baseVersion = process.argv[2] ?? process.env.FRAME_UPGRADE_BASE_VERSION ?? '0.7.1';
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for the cross-version upgrade gate.');
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(baseVersion)) {
  throw new Error(`Invalid base Frame version: ${baseVersion}`);
}
if (baseVersion === FRAME_VERSION) {
  throw new Error(
    'Cross-version upgrade gate requires a base version different from the candidate.',
  );
}

let registryToken = process.env.NODE_AUTH_TOKEN?.trim();
if (!registryToken) {
  const githubAuth = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
  if (githubAuth.status === 0) registryToken = githubAuth.stdout.trim();
}
if (!registryToken) {
  throw new Error('NODE_AUTH_TOKEN with GitHub Packages read access is required.');
}

const baselineSql = `
CREATE TABLE IF NOT EXISTS frame_upgrade_sentinel (
  id integer PRIMARY KEY,
  value text NOT NULL
);
`;
const candidateSql = `
ALTER TABLE frame_upgrade_sentinel
ADD COLUMN IF NOT EXISTS upgraded_at timestamptz;
`;

function createUpgradeExtension(includeCandidateMigration) {
  const migrations = [
    { id: '0001_sentinel.sql', sql: baselineSql },
    ...(includeCandidateMigration ? [{ id: '0002_candidate.sql', sql: candidateSql }] : []),
  ];
  return defineExtension({
    manifest: {
      id: 'upgrade-gate',
      version: '0.1.0',
      apiVersion: '1',
      frame: '^0.7.0',
      dependencies: [{ id: 'frame', version: '^0.7.0' }],
      migrations: {
        sourceId: 'upgrade-gate',
        migrations: migrations.map(({ id }) => ({ id })),
      },
    },
    migrations: defineMigrationExtension(
      defineMigrationSource({
        id: 'upgrade-gate',
        version: '0.1.0',
        dependencies: [{ id: 'frame', version: '^0.7.0' }],
        migrations,
      }),
    ),
  });
}

const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'frame-version-upgrade-'));
const sourceDatabase = new URL(databaseUrl);
const originalDatabase = sourceDatabase.pathname.slice(1);
const upgradeDatabase = `${originalDatabase}_upgrade_${randomBytes(4).toString('hex')}`;
if (!/^[a-zA-Z0-9_]+$/.test(upgradeDatabase)) throw new Error('Unsafe upgrade database name.');
const adminPool = new pg.Pool({ connectionString: databaseUrl });

try {
  await adminPool.query(`CREATE DATABASE "${upgradeDatabase}"`);
  const upgradeUrl = new URL(databaseUrl);
  upgradeUrl.pathname = `/${upgradeDatabase}`;

  const packageNames = [
    '@lingcootech/frame',
    '@lingcootech/frame-admin',
    '@lingcootech/frame-cms',
    '@lingcootech/frame-database',
    '@lingcootech/frame-design-tokens',
    '@lingcootech/frame-extension-sdk',
    '@lingcootech/frame-ui',
    '@lingcootech/frame-web',
  ];
  await writeFile(
    path.join(temporaryRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: Object.fromEntries(packageNames.map((name) => [name, baseVersion])),
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    path.join(temporaryRoot, '.npmrc'),
    '@lingcootech:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\nalways-auth=true\n',
  );
  const previousScript = `
import { frameCoreExtension, runSystemMigrations } from '@lingcootech/frame';
import { frameCmsExtension } from '@lingcootech/frame/cms';
import { defineExtension, defineSystem } from '@lingcootech/frame-extension-sdk';
import { defineMigrationExtension, defineMigrationSource } from '@lingcootech/frame-extension-sdk/migrations';
const sql = ${JSON.stringify(baselineSql)};
const extension = defineExtension({
  manifest: {
    id: 'upgrade-gate', version: '0.1.0', apiVersion: '1', frame: '^0.7.0',
    dependencies: [{ id: 'frame', version: '^0.7.0' }],
    migrations: { sourceId: 'upgrade-gate', migrations: [{ id: '0001_sentinel.sql' }] },
  },
  migrations: defineMigrationExtension(defineMigrationSource({
    id: 'upgrade-gate', version: '0.1.0', dependencies: [{ id: 'frame', version: '^0.7.0' }],
    migrations: [{ id: '0001_sentinel.sql', sql }],
  })),
});
const system = defineSystem({ id: 'upgrade-gate-system', version: '0.1.0', extensions: [frameCoreExtension, frameCmsExtension, extension] });
await runSystemMigrations({ connectionString: process.env.DATABASE_URL, system });
`;
  await writeFile(path.join(temporaryRoot, 'migrate-previous.mjs'), previousScript);
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: temporaryRoot,
    env: { ...process.env, NODE_AUTH_TOKEN: registryToken },
    stdio: 'inherit',
  });
  execFileSync('node', ['migrate-previous.mjs'], {
    cwd: temporaryRoot,
    env: { ...process.env, DATABASE_URL: upgradeUrl.toString() },
    stdio: 'inherit',
  });

  const candidatePool = new pg.Pool({ connectionString: upgradeUrl.toString() });
  try {
    await candidatePool.query(
      "INSERT INTO frame_upgrade_sentinel (id, value) VALUES (1, 'preserve-me')",
    );
    const before = await candidatePool.query(
      'SELECT count(*)::int AS count FROM framework_migrations',
    );

    const candidateSystem = defineSystem({
      id: 'upgrade-gate-system',
      version: '0.1.0',
      extensions: [frameCoreExtension, frameCmsExtension, createUpgradeExtension(true)],
    });
    const upgraded = await runSystemMigrations({
      connectionString: upgradeUrl.toString(),
      system: candidateSystem,
    });
    assert.ok(upgraded.applied.includes('upgrade-gate/0002_candidate.sql'));
    const sentinel = await candidatePool.query(
      'SELECT value, upgraded_at FROM frame_upgrade_sentinel WHERE id = 1',
    );
    assert.equal(sentinel.rows[0]?.value, 'preserve-me');
    assert.equal(sentinel.rows[0]?.upgraded_at, null);
    const after = await candidatePool.query(
      'SELECT count(*)::int AS count FROM framework_migrations',
    );
    assert.ok(after.rows[0].count > before.rows[0].count);

    const repeated = await runSystemMigrations({
      connectionString: upgradeUrl.toString(),
      system: candidateSystem,
    });
    assert.deepEqual(repeated.applied, []);
    assert.deepEqual(repeated.adopted, []);
  } finally {
    await candidatePool.end();
  }
  console.log(
    `Verified Frame ${baseVersion} -> ${FRAME_VERSION} with retained data and idempotency.`,
  );
} finally {
  await adminPool.query(`DROP DATABASE IF EXISTS "${upgradeDatabase}" WITH (FORCE)`);
  await adminPool.end();
  await rm(temporaryRoot, { recursive: true, force: true });
}

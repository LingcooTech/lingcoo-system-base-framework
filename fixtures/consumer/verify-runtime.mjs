import assert from 'node:assert/strict';

import { buildApp, createFrameWorker, loadEnv } from '@lingcoo/frame';
import { createDatabase, schema } from '@lingcoo/frame-database';
import {
  frameMigrationsDirectory,
  listMigrationFiles,
  runMigrations,
} from '@lingcoo/frame-database/migrations';

const databaseUrl = process.env.DATABASE_URL;
const migrations = listMigrationFiles();

assert.equal(migrations.length, 12);
assert.equal(migrations[0], '0000_base_system.sql');
assert.equal(migrations.at(-1), '0011_cms_workflow.sql');
assert.ok(frameMigrationsDirectory.endsWith('drizzle'));
assert.ok(schema.accounts);

if (databaseUrl) {
  const migrationResult = await runMigrations({
    connectionString: databaseUrl,
    logger: { log() {} },
  });
  assert.equal(migrationResult.applied.length + migrationResult.alreadyApplied.length, 12);
}

const env = loadEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: databaseUrl ?? 'postgres://frame:frame@127.0.0.1:1/frame_consumer_fixture',
  AUTH_JWT_SECRET: 'frame-consumer-fixture-secret-at-least-32-characters',
});

const app = await buildApp(env);
const health = await app.inject({ method: 'GET', url: '/health' });
assert.equal(health.statusCode, 200);
assert.equal(health.json().status, 'ok');
assert.equal(health.json().name, env.APP_NAME);
assert.equal(health.json().version, env.APP_VERSION);
await app.close();

const handle = createDatabase(env.DATABASE_URL);
await handle.pool.end();

const worker = createFrameWorker(env);
assert.equal(worker.getStatus().state, 'idle');
await worker.dispose();
assert.equal(worker.getStatus().state, 'stopped');

console.log('Packed Frame consumer runtime verified.');

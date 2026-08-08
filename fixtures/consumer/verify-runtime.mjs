import assert from 'node:assert/strict';

import {
  buildApp,
  createFrameWorker,
  frameCoreExtension,
  loadEnv,
  runSystemMigrations,
} from '@lingcoo/frame';
import { frameCmsExtension } from '@lingcoo/frame/cms';
import { frameCoreManifest } from '@lingcoo/frame/manifest';
import { exampleExtension } from '@lingcoo/frame-example-extension';
import { exampleAdminExtension } from '@lingcoo/frame-example-extension/admin';
import { exampleManifest } from '@lingcoo/frame-example-extension/contracts';
import { exampleWebExtension } from '@lingcoo/frame-example-extension/web';
import { createAdminRegistry } from '@lingcoo/frame-admin';
import { createCmsAdminClient, createCmsAdminExtension } from '@lingcoo/frame-cms/admin';
import { cmsManifest } from '@lingcoo/frame-cms/contracts';
import { createCmsWebClient, createCmsWebExtension } from '@lingcoo/frame-cms/web';
import { createWebRegistry } from '@lingcoo/frame-web';
import {
  defineExtension,
  defineSystem,
  projectExtensionManifest,
} from '@lingcoo/frame-extension-sdk';
import { createDatabase, schema } from '@lingcoo/frame-database';
import { frameMigrationsDirectory, listMigrationFiles } from '@lingcoo/frame-database/migrations';

const databaseUrl = process.env.DATABASE_URL;
const migrations = listMigrationFiles();
const system = defineSystem({
  id: 'packed-consumer',
  version: '0.1.0',
  extensions: [exampleExtension, frameCmsExtension, frameCoreExtension],
});

const frameDependency = defineExtension({
  manifest: projectExtensionManifest(frameCoreManifest, []),
});
const cmsAdminDefinition = defineExtension({
  manifest: projectExtensionManifest(cmsManifest, ['admin']),
  admin: createCmsAdminExtension({
    client: createCmsAdminClient(async () => {
      throw new Error('Packed Consumer must connect its authenticated Admin API transport');
    }),
  }),
});
const adminRegistry = createAdminRegistry(
  defineSystem({
    id: 'packed-consumer-admin',
    version: '0.1.0',
    extensions: [
      frameDependency,
      cmsAdminDefinition,
      defineExtension({
        manifest: projectExtensionManifest(exampleManifest, ['admin']),
        admin: exampleAdminExtension,
      }),
    ],
  }),
);
assert.equal(adminRegistry.matchRoute('/example/details')?.route.id, 'example.overview');
assert.equal(adminRegistry.matchRoute('/cms')?.route.id, 'frame-cms.content');
assert.ok(adminRegistry.navigation.some((item) => item.href === '/example'));
assert.ok(adminRegistry.navigation.some((item) => item.href === '/cms'));
assert.equal(adminRegistry.dashboardWidgets[0]?.id, 'example.summary');
assert.equal(adminRegistry.getLandingBlockEditor('example.hero')?.extensionId, 'example');
const searchGroups = await adminRegistry.searchProviders[0].search({
  context: {},
  query: '示例',
});
assert.equal(searchGroups[0]?.items[0]?.href, '/example');

const webRegistry = createWebRegistry(
  defineSystem({
    id: 'packed-consumer-web',
    version: '0.1.0',
    extensions: [
      frameDependency,
      defineExtension({
        manifest: projectExtensionManifest(cmsManifest, ['web']),
        web: createCmsWebExtension({
          client: createCmsWebClient(async () => {
            throw new Error('Packed Consumer must connect its Public Web fetch transport');
          }),
          resolvePresentation: () => null,
        }),
      }),
      defineExtension({
        manifest: projectExtensionManifest(exampleManifest, ['web']),
        web: exampleWebExtension,
      }),
    ],
  }),
);
assert.equal(webRegistry.matchRoute('/example')?.route.id, 'example.public');
assert.equal(webRegistry.matchRoute('/articles')?.route.id, 'frame-cms.articles');
assert.equal(
  (
    await webRegistry.resolveSeo('example.public', {
      context: {},
      params: {},
      pathname: '/example',
      searchParams: new URLSearchParams(),
    })
  )?.canonicalPath,
  '/example',
);
const sitemapEntries = await webRegistry.collectSitemap({});
assert.ok(sitemapEntries.some((item) => item.path === '/articles'));
assert.ok(sitemapEntries.some((item) => item.path === '/example'));
const preparedBlock = webRegistry.prepareLandingBlock({
  id: 'hero-1',
  type: 'example.hero',
  schemaVersion: 1,
  config: { title: 'Packed extension' },
});
assert.equal(preparedBlock.schemaVersion, 2);
assert.deepEqual(preparedBlock.config, {
  title: 'Packed extension',
  description: '',
  imageAssetId: null,
});

assert.equal(migrations.length, 10);
assert.equal(migrations[0], '0000_base_system.sql');
assert.equal(migrations.at(-1), '0010_account_security.sql');
assert.ok(frameMigrationsDirectory.endsWith('drizzle'));
assert.ok(schema.accounts);

if (databaseUrl) {
  const migrationResult = await runSystemMigrations({
    connectionString: databaseUrl,
    system,
    logger: { log() {} },
  });
  assert.equal(
    migrationResult.applied.length +
      migrationResult.adopted.length +
      migrationResult.alreadyApplied.length,
    13,
  );
}

const env = loadEnv({
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: databaseUrl ?? 'postgres://frame:frame@127.0.0.1:1/frame_consumer_fixture',
  AUTH_JWT_SECRET: 'frame-consumer-fixture-secret-at-least-32-characters',
});

const app = await buildApp(env, { system });
const health = await app.inject({ method: 'GET', url: '/health' });
assert.equal(health.statusCode, 200);
assert.equal(health.json().status, 'ok');
assert.equal(health.json().name, env.APP_NAME);
assert.equal(health.json().version, env.APP_VERSION);
const example = await app.inject({ method: 'GET', url: '/api/example' });
assert.equal(example.statusCode, 200);
assert.equal(example.json().extension, 'example');
assert.ok(app.hasRoute({ method: 'GET', url: '/api/public/cms/articles' }));
await app.close();

const handle = createDatabase(env.DATABASE_URL);
await handle.pool.end();

const worker = createFrameWorker(env, { system });
assert.equal(worker.getStatus().state, 'idle');
assert.ok(worker.getStatus().jobKinds.includes('example.echo'));
assert.ok(worker.getStatus().jobKinds.includes('cms.content.publish-scheduled'));
assert.ok(worker.getStatus().eventTopics.includes('example.created'));
await worker.dispose();
assert.equal(worker.getStatus().state, 'stopped');

console.log('Packed Frame consumer runtime verified.');

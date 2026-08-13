import assert from 'node:assert/strict';

import { assetsMigrationSource, frameAssetsExtension } from '@lingcootech/frame-assets';
import {
  presentationMigrationSource,
  framePresentationExtension,
} from '@lingcootech/frame-presentation';
import {
  buildApp,
  createFrameWorker,
  frameKernelExtension,
  loadEnv,
  runSystemMigrations,
} from '@lingcootech/frame';
import { frameCmsExtension } from '@lingcootech/frame/cms';
import { frameCoreManifest } from '@lingcootech/frame/manifest';
import { exampleExtension } from '@lingcootech/frame-example-extension';
import { exampleAdminExtension } from '@lingcootech/frame-example-extension/admin';
import { exampleManifest } from '@lingcootech/frame-example-extension/contracts';
import { exampleWebExtension } from '@lingcootech/frame-example-extension/web';
import { createAdminRegistry } from '@lingcootech/frame-admin';
import { createCmsAdminClient, createCmsAdminExtension } from '@lingcootech/frame-cms/admin';
import { cmsManifest } from '@lingcootech/frame-cms/contracts';
import { createCmsWebClient, createCmsWebExtension } from '@lingcootech/frame-cms/web';
import { createWebRegistry } from '@lingcootech/frame-web';
import {
  defineExtension,
  defineSystem,
  projectExtensionManifest,
} from '@lingcootech/frame-extension-sdk';
import { createDatabase, schema } from '@lingcootech/frame-database';
import { createPostgresAdapter } from '@lingcootech/frame-database';
import {
  frameMigrationsDirectory,
  listMigrationFiles,
} from '@lingcootech/frame-database/migrations';
import { buildFastifyHost } from '@lingcootech/frame-fastify';
import { frameKernelSystem } from '@lingcootech/frame-kernel';
import { frameIdentityManifest } from '@lingcootech/frame-identity/contracts';
import { frameIdentityExtension, identityMigrationSource } from '@lingcootech/frame-identity';
import {
  frameIntegrationsExtension,
  integrationsMigrationSource,
} from '@lingcootech/frame-integrations';
import { frameJobsExtension, jobsMigrationSource } from '@lingcootech/frame-jobs';
import {
  frameNotificationsExtension,
  notificationsMigrationSource,
} from '@lingcootech/frame-notifications';
import { createOpenTelemetryAdapter } from '@lingcootech/frame-opentelemetry';

const databaseUrl = process.env.DATABASE_URL;
const migrations = listMigrationFiles();
const system = defineSystem({
  id: 'packed-consumer',
  version: '0.1.0',
  extensions: [
    frameKernelExtension,
    frameIdentityExtension,
    frameIntegrationsExtension,
    frameJobsExtension,
    frameAssetsExtension,
    framePresentationExtension,
    frameNotificationsExtension,
    exampleExtension,
    frameCmsExtension,
  ],
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

assert.equal(migrations.length, 6);
assert.equal(migrations[0], '0000_base_system.sql');
assert.equal(migrations.at(-1), '0008_presentation.sql');
assert.ok(frameMigrationsDirectory.endsWith('drizzle'));
assert.ok(schema.accounts);
assert.equal(createPostgresAdapter().id, 'postgresql');
assert.equal(frameIdentityManifest.id, 'frame-identity');
assert.equal(frameIdentityManifest.dependencies, undefined);
assert.equal(identityMigrationSource.migrations[0].id, '0001_identity.sql');
assert.equal(integrationsMigrationSource.migrations[0].id, '0001_integrations.sql');
assert.equal(assetsMigrationSource.migrations[0].id, '0001_assets.sql');
assert.equal(presentationMigrationSource.migrations[0].id, '0001_presentation.sql');
assert.equal(jobsMigrationSource.migrations[0].id, '0001_jobs.sql');
assert.equal(notificationsMigrationSource.migrations[0].id, '0001_notifications.sql');

const kernelHost = await buildFastifyHost({
  system: frameKernelSystem,
  telemetry: createOpenTelemetryAdapter(),
  logger: false,
});
const kernelHealth = await kernelHost.inject({ method: 'GET', url: '/health' });
const kernelReady = await kernelHost.inject({ method: 'GET', url: '/ready' });
assert.equal(kernelHealth.statusCode, 200);
assert.equal(kernelReady.statusCode, 200);
assert.equal(kernelReady.json().database, 'not_configured');
assert.deepEqual(kernelHost.frameKernel.system.extensions, []);
await kernelHost.close();

if (databaseUrl) {
  const expectedMigrationCount = system.extensions.reduce(
    (count, extension) => count + (extension.migrations?.source.migrations.length ?? 0),
    0,
  );
  const migrationResult = await runSystemMigrations({
    connectionString: databaseUrl,
    system,
    logger: { log() {} },
  });
  assert.equal(
    migrationResult.applied.length +
      migrationResult.adopted.length +
      migrationResult.alreadyApplied.length,
    expectedMigrationCount,
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

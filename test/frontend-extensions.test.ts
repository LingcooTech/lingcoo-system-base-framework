import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminRegistry } from '@lingcoo/frame-admin';
import { exampleAdminExtension } from '@lingcoo/frame-example-extension/admin';
import { exampleManifest } from '@lingcoo/frame-example-extension/contracts';
import { exampleWebExtension } from '@lingcoo/frame-example-extension/web';
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
  type ExtensionManifest,
} from '@lingcoo/frame-extension-sdk';
import { createWebRegistry, type StoredLandingBlock } from '@lingcoo/frame-web';

function extension(id: string, contributions: Partial<ExtensionManifest> = {}) {
  return defineExtension({
    manifest: {
      id,
      version: '1.0.0',
      apiVersion: '1',
      frame: `^${FRAME_VERSION}`,
      ...contributions,
    },
  });
}

const frameDependency = extension('frame', { version: FRAME_VERSION });

test('defineSystem rejects frontend route, contribution and Landing Block conflicts', () => {
  assert.throws(
    () =>
      defineSystem({
        id: 'admin-route-conflict',
        version: '1.0.0',
        extensions: [
          extension('alpha', {
            admin: {
              routes: [
                {
                  id: 'alpha.detail',
                  path: '/shared/:id',
                  title: 'Alpha',
                  permission: 'alpha.read',
                },
              ],
            },
          }),
          extension('beta', {
            admin: {
              routes: [
                {
                  id: 'beta.detail',
                  path: '/shared/:slug',
                  title: 'Beta',
                  permission: 'beta.read',
                },
              ],
            },
          }),
        ],
      }),
    /Duplicate Admin route/,
  );

  assert.throws(
    () =>
      defineSystem({
        id: 'landing-conflict',
        version: '1.0.0',
        extensions: [
          extension('alpha', {
            web: { landingBlocks: [{ type: 'shared.hero', schemaVersion: 1 }] },
          }),
          extension('beta', {
            web: { landingBlocks: [{ type: 'shared.hero', schemaVersion: 2 }] },
          }),
        ],
      }),
    /Duplicate Landing Block type/,
  );

  assert.throws(
    () =>
      defineSystem({
        id: 'orphan-editor',
        version: '1.0.0',
        extensions: [
          extension('orphan', {
            admin: { landingBlockEditors: [{ type: 'orphan.hero', label: 'Hero' }] },
          }),
        ],
      }),
    /has no matching Web declaration/,
  );
});

test('Admin Registry composes example routes, navigation, widgets, search and editors', async () => {
  const system = defineSystem({
    id: 'example-admin-system',
    version: '1.0.0',
    extensions: [
      frameDependency,
      defineExtension({
        manifest: projectExtensionManifest(exampleManifest, ['admin']),
        admin: exampleAdminExtension,
      }),
    ],
  });
  const registry = createAdminRegistry(system);

  assert.equal(registry.matchRoute('/example/details')?.route.id, 'example.overview');
  assert.equal(registry.navigation[0]?.label, '示例扩展');
  assert.equal(registry.dashboardWidgets[0]?.id, 'example.summary');
  assert.equal(registry.getLandingBlockEditor('example.hero')?.extensionId, 'example');
  const groups = await registry.searchProviders[0]!.search({ context: {}, query: '示例' });
  assert.equal(groups[0]?.items[0]?.href, '/example');
});

test('Web Registry composes routes, SEO, Sitemap and controlled Landing Blocks', async () => {
  const system = defineSystem({
    id: 'example-web-system',
    version: '1.0.0',
    extensions: [
      frameDependency,
      defineExtension({
        manifest: projectExtensionManifest(exampleManifest, ['web']),
        web: exampleWebExtension,
      }),
    ],
  });
  const registry = createWebRegistry(system);

  assert.equal(registry.matchRoute('/example')?.route.id, 'example.public');
  assert.equal(
    (
      await registry.resolveSeo('example.public', {
        context: {},
        params: {},
        pathname: '/example',
        searchParams: new URLSearchParams(),
      })
    )?.canonicalPath,
    '/example',
  );
  assert.equal((await registry.collectSitemap({}))[0]?.path, '/example');

  const prepared = registry.prepareLandingBlock({
    id: 'hero-1',
    type: 'example.hero',
    schemaVersion: 1,
    config: { title: 'Extension Hero', imageAssetId: 'asset-1' },
  });
  assert.equal(prepared.schemaVersion, 2);
  assert.deepEqual(prepared.config, {
    title: 'Extension Hero',
    description: '',
    imageAssetId: 'asset-1',
  });
  assert.deepEqual(prepared.assets, [{ assetId: 'asset-1', role: 'background' }]);

  assert.throws(
    () =>
      registry.prepareLandingBlock({
        id: 'unsafe',
        type: 'example.hero',
        schemaVersion: 2,
        config: { title: 'Unsafe', callback() {} },
      } as unknown as StoredLandingBlock),
    /JSON data only/,
  );
  assert.throws(
    () =>
      registry.prepareLandingBlock({
        id: 'future',
        type: 'example.hero',
        schemaVersion: 3,
        config: { title: 'Future' },
      }),
    /future schema version/,
  );
});

test('frontend registries reject missing and undeclared runtime contributions', () => {
  const missingSurface = defineSystem({
    id: 'missing-admin-surface',
    version: '1.0.0',
    extensions: [
      extension('missing', {
        admin: {
          routes: [
            {
              id: 'missing.page',
              path: '/missing',
              title: 'Missing',
              permission: 'missing.read',
            },
          ],
        },
      }),
    ],
  });
  assert.throws(() => createAdminRegistry(missingSurface), /without a surface/);

  const undeclaredRuntime = defineSystem({
    id: 'undeclared-web-runtime',
    version: '1.0.0',
    extensions: [
      defineExtension({
        manifest: extension('runtime').manifest,
        web: { routes: [{ id: 'runtime.page', component: () => null }] },
      }),
    ],
  });
  assert.throws(() => createWebRegistry(undeclaredRuntime), /undeclared Web route/);
});

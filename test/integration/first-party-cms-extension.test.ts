import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminRegistry, defineAdminExtension } from '@lingcootech/frame-admin';
import { frameAdminManifest } from '@lingcootech/frame-admin/manifest';
import { createCmsAdminExtension } from '@lingcootech/frame-cms/admin';
import { cmsManifest } from '@lingcootech/frame-cms/contracts';
import { createCmsWebExtension } from '@lingcootech/frame-cms/web';
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
} from '@lingcootech/frame-extension-sdk';
import { createWebRegistry, defineWebExtension } from '@lingcootech/frame-web';
import { frameWebManifest } from '@lingcootech/frame-web/manifest';

import { buildApp, createFrameWorker, frameCoreExtension, loadEnv } from '@lingcootech/frame';
import { frameCmsExtension } from '@lingcootech/frame/cms';

import { collectSystemMigrationSources } from '../../packages/frame/src/runtime/extensions.js';

const EmptyPage = () => null;

function testEnv() {
  return loadEnv({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://frame:frame@127.0.0.1:1/frame_cms_extension_test',
    AUTH_JWT_SECRET: 'frame-cms-extension-test-secret-at-least-32-characters',
  });
}

test('CMS can be enabled or disabled across Server, Worker and Migration surfaces', async () => {
  const coreOnly = defineSystem({
    id: 'core-only',
    version: FRAME_VERSION,
    extensions: [frameCoreExtension],
  });
  const withCms = defineSystem({
    id: 'core-with-cms',
    version: FRAME_VERSION,
    extensions: [frameCmsExtension, frameCoreExtension],
  });

  assert.deepEqual(
    coreOnly.extensions.map((extension) => extension.manifest.id),
    ['frame'],
  );
  assert.deepEqual(
    withCms.extensions.map((extension) => extension.manifest.id),
    ['frame', 'frame-cms'],
  );
  assert.deepEqual(
    collectSystemMigrationSources(coreOnly).map((source) => source.id),
    ['frame'],
  );
  assert.deepEqual(
    collectSystemMigrationSources(withCms).map((source) => source.id),
    ['frame', 'frame-cms'],
  );

  const coreApp = await buildApp(testEnv(), { system: coreOnly });
  assert.equal(coreApp.hasRoute({ method: 'GET', url: '/api/public/cms/articles' }), false);
  await coreApp.close();
  const cmsApp = await buildApp(testEnv(), { system: withCms });
  assert.equal(cmsApp.hasRoute({ method: 'GET', url: '/api/public/cms/articles' }), true);
  await cmsApp.close();

  const coreWorker = createFrameWorker(testEnv(), { system: coreOnly });
  assert.equal(coreWorker.getStatus().jobKinds.includes('cms.content.publish-scheduled'), false);
  await coreWorker.dispose();
  const cmsWorker = createFrameWorker(testEnv(), { system: withCms });
  assert.equal(cmsWorker.getStatus().jobKinds.includes('cms.content.publish-scheduled'), true);
  await cmsWorker.dispose();
});

test('CMS can be enabled or disabled without changing Admin or Web shell routes', () => {
  const adminCore = defineExtension({
    manifest: {
      id: 'frame',
      version: FRAME_VERSION,
      apiVersion: '1',
      frame: `^${FRAME_VERSION}`,
      admin: frameAdminManifest,
    },
    admin: defineAdminExtension({
      routes: frameAdminManifest.routes.map((route) => ({ id: route.id, component: EmptyPage })),
      navigation: frameAdminManifest.navigation.map((item) => ({ id: item.id })),
      searchProviders: [
        {
          id: 'frame.resources',
          async search() {
            return [];
          },
        },
      ],
    }),
  });
  const adminCms = defineExtension({
    manifest: projectExtensionManifest(cmsManifest, ['admin']),
    admin: createCmsAdminExtension({ component: EmptyPage }),
  });
  const coreAdminRegistry = createAdminRegistry(
    defineSystem({ id: 'admin-core-only', version: FRAME_VERSION, extensions: [adminCore] }),
  );
  const cmsAdminRegistry = createAdminRegistry(
    defineSystem({
      id: 'admin-with-cms',
      version: FRAME_VERSION,
      extensions: [adminCore, adminCms],
    }),
  );
  assert.equal(coreAdminRegistry.matchRoute('/cms'), undefined);
  assert.equal(cmsAdminRegistry.matchRoute('/cms')?.route.id, 'frame-cms.content');
  assert.deepEqual(
    coreAdminRegistry.navigation.map((item) => item.label),
    ['应用设置'],
  );
  assert.deepEqual(
    cmsAdminRegistry.navigation.map((item) => item.label),
    ['内容管理', '应用设置'],
  );
  assert.equal(coreAdminRegistry.matchRoute('/system')?.route.id, 'frame.system-info');
  assert.equal(coreAdminRegistry.matchRoute('/operations')?.route.id, 'frame.operations');
  assert.equal(
    coreAdminRegistry.navigation.some((item) => item.href === '/system'),
    false,
  );
  assert.equal(
    coreAdminRegistry.navigation.some((item) => item.href === '/operations'),
    false,
  );

  const webCore = defineExtension({
    manifest: {
      id: 'frame',
      version: FRAME_VERSION,
      apiVersion: '1',
      frame: `^${FRAME_VERSION}`,
      web: frameWebManifest,
    },
    web: defineWebExtension({
      routes: frameWebManifest.routes.map((route) => ({ id: route.id, component: EmptyPage })),
    }),
  });
  const webCms = defineExtension({
    manifest: projectExtensionManifest(cmsManifest, ['web']),
    web: createCmsWebExtension({
      preview: EmptyPage,
      articleIndex: EmptyPage,
      article: EmptyPage,
      page: EmptyPage,
    }),
  });
  const coreWebRegistry = createWebRegistry(
    defineSystem({ id: 'web-core-only', version: FRAME_VERSION, extensions: [webCore] }),
  );
  const cmsWebRegistry = createWebRegistry(
    defineSystem({
      id: 'web-with-cms',
      version: FRAME_VERSION,
      extensions: [webCore, webCms],
    }),
  );
  assert.equal(coreWebRegistry.matchRoute('/')?.route, undefined);
  assert.equal(coreWebRegistry.matchRoute('/auth/login')?.route.id, 'frame.auth');
  assert.equal(coreWebRegistry.matchRoute('/articles'), undefined);
  assert.equal(cmsWebRegistry.matchRoute('/articles')?.route.id, 'frame-cms.articles');
});

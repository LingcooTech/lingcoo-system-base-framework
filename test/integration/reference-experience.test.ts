import assert from 'node:assert/strict';
import test from 'node:test';

import type { ServerExtensionSurface } from '@lingcootech/frame-extension-sdk/server';
import { frameWebManifest } from '@lingcootech/frame-web/manifest';

import { referenceSiteServerExtension } from '../../apps/reference-system/src/site.js';
import {
  officialSitemapEntries,
  referenceSiteManifest,
} from '../../apps/reference-web/src/site/manifest.js';

test('Frame Web leaves the public homepage to the Consumer site extension', () => {
  assert.deepEqual(frameWebManifest.routes, [{ id: 'frame.auth', path: '/auth/:mode' }]);
  assert.equal(
    frameWebManifest.routes.some((route) => route.path === '/'),
    false,
  );
  assert.equal(
    referenceSiteManifest.routes.find((route) => route.path === '/')?.id,
    'reference.home',
  );
  assert.equal(
    referenceSiteManifest.routes.find((route) => route.path === '/docs/:slug')?.id,
    'reference.docs.detail',
  );
});

test('Reference Server contributes the official static paths to the public Sitemap', async () => {
  const collectors = new Map<string, () => Promise<readonly { path: string }[]>>();
  const surface = referenceSiteServerExtension.server as ServerExtensionSurface<{
    publicSiteRegistry: {
      registerSitemapCollector(
        id: string,
        collector: () => Promise<readonly { path: string }[]>,
      ): void;
    };
  }>;

  await surface.register({
    app: {
      publicSiteRegistry: {
        registerSitemapCollector(id, collector) {
          collectors.set(id, collector);
        },
      },
    },
  });

  const collect = collectors.get('frame-reference-site.static');
  assert.ok(collect);
  const paths = (await collect()).map((route) => route.path);
  for (const route of officialSitemapEntries) assert.ok(paths.includes(route.path));
  assert.ok(paths.includes('/docs/architecture'));
  assert.ok(paths.includes('/docs/reference-experience-roadmap'));
  assert.equal(
    paths.some((path) => path.startsWith('/admin')),
    false,
  );
});

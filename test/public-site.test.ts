import assert from 'node:assert/strict';
import test from 'node:test';

import { buildRobots, buildSitemap } from '../src/modules/public-site/discovery.js';

test('public discovery files use the configured site URL and published CMS routes', () => {
  const sitemap = buildSitemap('https://example.test/base', [
    { type: 'article', slug: 'release-notes', updatedAt: new Date('2026-08-03T08:00:00Z') },
    { type: 'page', slug: 'about-us', updatedAt: new Date('2026-08-02T08:00:00Z') },
  ]);
  assert.match(sitemap, /<loc>https:\/\/example\.test\/articles\/release-notes<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/example\.test\/pages\/about-us<\/loc>/);
  assert.match(sitemap, /<lastmod>2026-08-03T08:00:00\.000Z<\/lastmod>/);

  const robots = buildRobots('https://example.test');
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/auth\//);
  assert.match(robots, /Disallow: \/preview\//);
  assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
});

import type { ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const referenceSiteRoutes = [
  { id: 'reference.home', path: '/' },
  { id: 'reference.framework', path: '/framework' },
  { id: 'reference.architecture', path: '/architecture' },
  { id: 'reference.packages', path: '/packages' },
  { id: 'reference.extensions', path: '/extensions' },
  { id: 'reference.docs', path: '/docs' },
  { id: 'reference.docs.detail', path: '/docs/:slug' },
  { id: 'reference.releases', path: '/releases' },
] as const;

export const officialSitemapEntries = [
  { path: '/', changeFrequency: 'weekly', priority: 1 },
  { path: '/framework', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/architecture', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/packages', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/extensions', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/docs', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/releases', changeFrequency: 'weekly', priority: 0.6 },
] as const;

export const referenceSiteManifest = {
  routes: referenceSiteRoutes,
  seo: referenceSiteRoutes.map(({ id }) => ({ id, routeId: id })),
  sitemap: referenceSiteRoutes
    .filter(({ id }) => id !== 'reference.docs.detail')
    .map(({ id }) => ({ id })),
} as const satisfies NonNullable<ExtensionManifest['web']>;

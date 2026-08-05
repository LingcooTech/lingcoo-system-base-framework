import type { ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const frameWebManifest = {
  routes: [
    { id: 'frame.auth', path: '/auth/:mode' },
    { id: 'frame.preview-content', path: '/preview/content/:id' },
    { id: 'frame.articles', path: '/articles' },
    { id: 'frame.article', path: '/articles/:slug' },
    { id: 'frame.page', path: '/pages/:slug' },
    { id: 'frame.home', path: '/' },
  ],
  seo: [
    { id: 'frame.home', routeId: 'frame.home' },
    { id: 'frame.articles', routeId: 'frame.articles' },
  ],
  sitemap: [{ id: 'frame.public-content' }],
} as const satisfies NonNullable<ExtensionManifest['web']>;

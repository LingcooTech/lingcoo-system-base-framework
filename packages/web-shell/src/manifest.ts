import type { ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const frameWebManifest = {
  routes: [
    { id: 'frame.auth', path: '/auth/:mode' },
    { id: 'frame.home', path: '/' },
  ],
  seo: [{ id: 'frame.home', routeId: 'frame.home' }],
  sitemap: [{ id: 'frame.home' }],
} as const satisfies NonNullable<ExtensionManifest['web']>;

import type { ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const frameWebManifest = {
  routes: [{ id: 'frame.auth', path: '/auth/:mode' }],
} as const satisfies NonNullable<ExtensionManifest['web']>;

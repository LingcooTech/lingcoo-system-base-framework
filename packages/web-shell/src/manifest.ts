import type { ExtensionManifest } from '@lingcootech/frame-extension-sdk';

export const frameKernelWebManifest = {} as const satisfies NonNullable<ExtensionManifest['web']>;

export const frameIdentityWebManifest = {
  routes: [{ id: 'frame.auth', path: '/auth/:mode' }],
} as const satisfies NonNullable<ExtensionManifest['web']>;

/** @deprecated Prefer frameIdentityWebManifest for the optional Identity extension. */
export const frameWebManifest = frameIdentityWebManifest;

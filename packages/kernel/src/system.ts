import { defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';

/** The architectural minimum: a runnable system with no product features. */
export const frameKernelSystem = defineSystem({
  id: 'frame-kernel-system',
  version: FRAME_VERSION,
  extensions: [],
});

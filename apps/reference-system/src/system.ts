import { frameCoreExtension } from '@lingcoo/frame/extensions';
import { defineSystem, FRAME_VERSION } from '@lingcoo/frame-extension-sdk';

import { frameCmsExtension } from './cms.js';

export const referenceSystem = defineSystem({
  id: 'frame-reference-system',
  version: FRAME_VERSION,
  extensions: [frameCoreExtension, frameCmsExtension],
});

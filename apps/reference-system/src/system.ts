import { frameCoreExtension } from '@lingcootech/frame/extensions';
import { defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';

import { frameCmsExtension } from './cms.js';
import { referenceSiteServerExtension } from './site.js';

export const referenceSystem = defineSystem({
  id: 'frame-reference-system',
  version: FRAME_VERSION,
  extensions: [frameCoreExtension, frameCmsExtension, referenceSiteServerExtension],
});

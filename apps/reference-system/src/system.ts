import { frameAssetsExtension } from '@lingcootech/frame-assets';
import {
  frameIntegrationsExtension,
  frameKernelExtension,
  frameNotificationsExtension,
} from '@lingcootech/frame/extensions';
import { defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import { frameIdentityExtension } from '@lingcootech/frame-identity';
import { frameJobsExtension } from '@lingcootech/frame-jobs';
import { framePresentationExtension } from '@lingcootech/frame-presentation';

import { frameCmsExtension } from './cms.js';
import { referenceSiteServerExtension } from './site.js';

export const referenceSystem = defineSystem({
  id: 'frame-reference-system',
  version: FRAME_VERSION,
  extensions: [
    frameKernelExtension,
    frameIdentityExtension,
    frameIntegrationsExtension,
    frameJobsExtension,
    frameAssetsExtension,
    framePresentationExtension,
    frameNotificationsExtension,
    frameCmsExtension,
    referenceSiteServerExtension,
  ],
});

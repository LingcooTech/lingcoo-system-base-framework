import { frameAssetsExtension } from '@lingcootech/frame-assets';
import {
  frameIntegrationsExtension,
  frameKernelExtension,
  frameNotificationsExtension,
} from '@lingcootech/frame/extensions';
// <cms>
import { frameCmsExtension } from '@lingcootech/frame/cms';
// </cms>
import { defineSystem } from '@lingcootech/frame-extension-sdk';
import { frameIdentityExtension } from '@lingcootech/frame-identity';
import { frameJobsExtension } from '@lingcootech/frame-jobs';
import { framePresentationExtension } from '@lingcootech/frame-presentation';
import { domainExtension } from '__PACKAGE_SCOPE__/__PROJECT_NAME__-domain';

export const applicationSystem = defineSystem({
  id: '__SYSTEM_ID__',
  version: '0.1.0',
  extensions: [
    frameKernelExtension,
    frameIdentityExtension,
    frameIntegrationsExtension,
    frameJobsExtension,
    frameAssetsExtension,
    framePresentationExtension,
    frameNotificationsExtension,
    // <cms>
    frameCmsExtension,
    // </cms>
    domainExtension,
  ],
});

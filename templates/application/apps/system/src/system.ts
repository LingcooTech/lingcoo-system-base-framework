import { frameCoreExtension } from '@lingcootech/frame/extensions';
// <cms>
import { frameCmsExtension } from '@lingcootech/frame/cms';
// </cms>
import { defineSystem } from '@lingcootech/frame-extension-sdk';
import { domainExtension } from '__PACKAGE_SCOPE__/__PROJECT_NAME__-domain';

export const applicationSystem = defineSystem({
  id: '__SYSTEM_ID__',
  version: '0.1.0',
  extensions: [
    frameCoreExtension,
    // <cms>
    frameCmsExtension,
    // </cms>
    domainExtension,
  ],
});

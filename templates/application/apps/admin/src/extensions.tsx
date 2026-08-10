import { createAdminRegistry } from '@lingcootech/frame-admin';
import { apiRequest, createFrameAdminExtension } from '@lingcootech/frame-admin/defaults';
import { frameAdminManifest } from '@lingcootech/frame-admin/manifest';
// <cms>
import { createCmsAdminClient, createCmsAdminExtension } from '@lingcootech/frame-cms/admin';
import { cmsManifest } from '@lingcootech/frame-cms/contracts';
// </cms>
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
} from '@lingcootech/frame-extension-sdk';
import { domainAdminExtension } from '__PACKAGE_SCOPE__/__PROJECT_NAME__-domain/admin';
import { domainManifest } from '__PACKAGE_SCOPE__/__PROJECT_NAME__-domain/contracts';

export type AdminAppContext = Record<string, never>;

const frameDefinition = defineExtension({
  manifest: {
    id: 'frame',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    admin: frameAdminManifest,
  },
  admin: createFrameAdminExtension<AdminAppContext>(),
});

// <cms>
const cmsDefinition = defineExtension({
  manifest: projectExtensionManifest(cmsManifest, ['admin']),
  admin: createCmsAdminExtension<AdminAppContext>({ client: createCmsAdminClient(apiRequest) }),
});
// </cms>

const domainDefinition = defineExtension({
  manifest: projectExtensionManifest(domainManifest, ['admin']),
  admin: domainAdminExtension,
});

export const adminSystem = defineSystem({
  id: '__SYSTEM_ID__-admin',
  version: '0.1.0',
  extensions: [
    frameDefinition,
    // <cms>
    cmsDefinition,
    // </cms>
    domainDefinition,
  ],
});

export const adminRegistry = createAdminRegistry<AdminAppContext>(adminSystem);

import { createAdminRegistry } from '@lingcootech/frame-admin';
import {
  apiRequest,
  createFrameIdentityAdminExtension,
  createFrameIntegrationsAdminExtension,
  createFrameAssetsAdminExtension,
  createFrameJobsAdminExtension,
  createFrameKernelAdminExtension,
  createFrameNotificationsAdminExtension,
  createFramePresentationAdminExtension,
} from '@lingcootech/frame-admin/defaults';
import {
  frameIdentityAdminManifest,
  frameIntegrationsAdminManifest,
  frameAssetsAdminManifest,
  frameJobsAdminManifest,
  frameKernelAdminManifest,
  frameNotificationsAdminManifest,
  framePresentationAdminManifest,
} from '@lingcootech/frame-admin/manifest';
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

const frameKernelDefinition = defineExtension({
  manifest: {
    id: 'frame',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    admin: frameKernelAdminManifest,
  },
  admin: createFrameKernelAdminExtension<AdminAppContext>(),
});

const frameIdentityDefinition = defineExtension({
  manifest: {
    id: 'frame-identity',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
    admin: frameIdentityAdminManifest,
  },
  admin: createFrameIdentityAdminExtension<AdminAppContext>(),
});

const frameIntegrationsDefinition = defineExtension({
  manifest: {
    id: 'frame-integrations',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
    admin: frameIntegrationsAdminManifest,
  },
  admin: createFrameIntegrationsAdminExtension<AdminAppContext>(),
});

const frameAssetsDefinition = defineExtension({
  manifest: {
    id: 'frame-assets',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [
      { id: 'frame-identity', version: `^${FRAME_VERSION}` },
      { id: 'frame-jobs', version: `^${FRAME_VERSION}` },
    ],
    admin: frameAssetsAdminManifest,
  },
  admin: createFrameAssetsAdminExtension<AdminAppContext>(),
});

const framePresentationDefinition = defineExtension({
  manifest: {
    id: 'frame-presentation',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
    admin: framePresentationAdminManifest,
  },
  admin: createFramePresentationAdminExtension<AdminAppContext>(),
});

const frameJobsDefinition = defineExtension({
  manifest: {
    id: 'frame-jobs',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [{ id: 'frame-identity', version: `^${FRAME_VERSION}` }],
    admin: frameJobsAdminManifest,
  },
  admin: createFrameJobsAdminExtension<AdminAppContext>(),
});

const frameNotificationsDefinition = defineExtension({
  manifest: {
    id: 'frame-notifications',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [
      { id: 'frame-identity', version: `^${FRAME_VERSION}` },
      { id: 'frame-jobs', version: `^${FRAME_VERSION}` },
    ],
    admin: frameNotificationsAdminManifest,
  },
  admin: createFrameNotificationsAdminExtension<AdminAppContext>(),
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
    frameKernelDefinition,
    frameIdentityDefinition,
    frameIntegrationsDefinition,
    frameJobsDefinition,
    frameAssetsDefinition,
    framePresentationDefinition,
    frameNotificationsDefinition,
    // <cms>
    cmsDefinition,
    // </cms>
    domainDefinition,
  ],
});

export const adminRegistry = createAdminRegistry<AdminAppContext>(adminSystem);

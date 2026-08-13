import { createAdminRegistry, defineAdminExtension } from '@lingcootech/frame-admin';
import {
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
import { createCmsAdminClient, createCmsAdminExtension } from '@lingcootech/frame-cms/admin';
import { cmsManifest } from '@lingcootech/frame-cms/contracts';
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
} from '@lingcootech/frame-extension-sdk';
import { apiRequest } from '@lingcootech/frame-admin/defaults';
import { HomePage } from './pages/HomePage';

export type AdminAppContext = Record<string, never>;

const frameKernelAdminDefinition = defineExtension({
  manifest: {
    id: 'frame',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    admin: frameKernelAdminManifest,
  },
  admin: createFrameKernelAdminExtension<AdminAppContext>(),
});

const frameIdentityAdminDefinition = defineExtension({
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

const frameIntegrationsAdminDefinition = defineExtension({
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

const frameAssetsAdminDefinition = defineExtension({
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

const framePresentationAdminDefinition = defineExtension({
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

const frameJobsAdminDefinition = defineExtension({
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

const frameNotificationsAdminDefinition = defineExtension({
  manifest: {
    id: 'frame-notifications',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [
      { id: 'frame-identity', version: `^${FRAME_VERSION}` },
      { id: 'frame-integrations', version: `^${FRAME_VERSION}` },
      { id: 'frame-jobs', version: `^${FRAME_VERSION}` },
    ],
    admin: frameNotificationsAdminManifest,
  },
  admin: createFrameNotificationsAdminExtension<AdminAppContext>(),
});

const cmsAdminDefinition = defineExtension({
  manifest: projectExtensionManifest(cmsManifest, ['admin']),
  admin: createCmsAdminExtension<AdminAppContext>({
    client: createCmsAdminClient(apiRequest),
  }),
});

const referenceAdminDefinition = defineExtension({
  manifest: {
    id: 'frame-reference-app',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [
      { id: 'frame', version: `^${FRAME_VERSION}` },
      { id: 'frame-identity', version: `^${FRAME_VERSION}` },
      { id: 'frame-jobs', version: `^${FRAME_VERSION}` },
      { id: 'frame-notifications', version: `^${FRAME_VERSION}` },
    ],
    admin: {
      routes: [
        {
          id: 'reference.home',
          path: '/',
          title: 'Frame Console',
          description: 'Frame 官方站和在线参考系统的应用级起始页。',
          permission: 'admin.access',
        },
      ],
    },
  },
  admin: defineAdminExtension<AdminAppContext>({
    routes: [{ id: 'reference.home', component: HomePage }],
  }),
});

export const adminSystem = defineSystem({
  id: 'frame-reference-admin',
  version: FRAME_VERSION,
  extensions: [
    frameKernelAdminDefinition,
    frameIdentityAdminDefinition,
    frameIntegrationsAdminDefinition,
    frameJobsAdminDefinition,
    frameAssetsAdminDefinition,
    framePresentationAdminDefinition,
    frameNotificationsAdminDefinition,
    cmsAdminDefinition,
    referenceAdminDefinition,
  ],
});

export const adminRegistry = createAdminRegistry<AdminAppContext>(adminSystem);

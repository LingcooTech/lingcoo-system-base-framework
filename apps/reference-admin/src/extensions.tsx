import { createAdminRegistry, defineAdminExtension } from '@lingcootech/frame-admin';
import { createFrameAdminExtension } from '@lingcootech/frame-admin/defaults';
import { frameAdminManifest } from '@lingcootech/frame-admin/manifest';
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

const frameAdminSurface = createFrameAdminExtension<AdminAppContext>();

const frameAdminDefinition = defineExtension({
  manifest: {
    id: 'frame',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    admin: frameAdminManifest,
  },
  admin: frameAdminSurface,
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
    dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
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
  extensions: [frameAdminDefinition, cmsAdminDefinition, referenceAdminDefinition],
});

export const adminRegistry = createAdminRegistry<AdminAppContext>(adminSystem);

import { createAdminRegistry, defineAdminExtension } from '@lingcoo/frame-admin';
import { frameAdminManifest } from '@lingcoo/frame-admin/manifest';
import { createCmsAdminExtension } from '@lingcoo/frame-cms/admin';
import { cmsManifest } from '@lingcoo/frame-cms/contracts';
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
} from '@lingcoo/frame-extension-sdk';
import { BookOpenText, Settings2 } from 'lucide-react';

import { searchResources } from './api/client';
import { AccessPage } from './pages/AccessPage';
import { AccountPage } from './pages/AccountPage';
import { AssetsPage } from './pages/AssetsPage';
import { AuditPage } from './pages/AuditPage';
import { CmsPage } from './pages/CmsPage';
import { HelpPage } from './pages/HelpPage';
import { HomePage } from './pages/HomePage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { MetadataPage } from './pages/MetadataPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ObservabilityPage } from './pages/ObservabilityPage';
import { OperationsPage } from './pages/OperationsPage';
import { PresentationPage } from './pages/PresentationPage';
import { SettingsPage } from './pages/SettingsPage';
import { SystemInfoPage } from './pages/SystemInfoPage';

export type AdminAppContext = Record<string, never>;

const frameAdminSurface = defineAdminExtension<AdminAppContext>({
  routes: [
    { id: 'frame.system-info', component: SystemInfoPage },
    { id: 'frame.access', component: AccessPage },
    { id: 'frame.integrations', component: IntegrationsPage },
    { id: 'frame.assets', component: AssetsPage },
    { id: 'frame.operations', component: OperationsPage },
    { id: 'frame.observability', component: ObservabilityPage },
    { id: 'frame.notifications', component: NotificationsPage },
    { id: 'frame.metadata', component: MetadataPage },
    { id: 'frame.audit', component: AuditPage },
    { id: 'frame.presentation', component: PresentationPage },
    { id: 'frame.account', component: AccountPage },
    { id: 'frame.settings', component: SettingsPage },
    { id: 'frame.help', component: HelpPage },
  ],
  navigation: [{ id: 'frame.settings', icon: Settings2 }],
  searchProviders: [
    {
      id: 'frame.resources',
      async search({ query }) {
        const groups = await searchResources(query);
        return groups.map((group) => ({
          id: group.source,
          label: group.label,
          items: group.items.map((item) => ({
            id: `${item.source}-${item.id}`,
            title: item.title,
            subtitle: item.subtitle,
            href: item.href,
            kind: item.kind,
          })),
        }));
      },
    },
  ],
});

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
    component: CmsPage,
    icon: BookOpenText,
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
          title: '参考应用',
          description: 'Frame Reference App 的应用级起始页。',
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

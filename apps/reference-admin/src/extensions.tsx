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
import {
  Activity,
  Bell,
  BookOpenText,
  CircleHelp,
  DatabaseZap,
  Gauge,
  Images,
  ListChecks,
  Palette,
  PlugZap,
  ScrollText,
  Settings2,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';

import { searchResources } from './api/client';
import { AccessPage } from './pages/AccessPage';
import { AccountPage } from './pages/AccountPage';
import { AssetsPage } from './pages/AssetsPage';
import { AuditPage } from './pages/AuditPage';
import { CmsPage } from './pages/CmsPage';
import { DashboardPage } from './pages/DashboardPage';
import { HelpPage } from './pages/HelpPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { MetadataPage } from './pages/MetadataPage';
import { ModulesPage } from './pages/ModulesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ObservabilityPage } from './pages/ObservabilityPage';
import { OperationsPage } from './pages/OperationsPage';
import { PresentationPage } from './pages/PresentationPage';
import { SettingsPage } from './pages/SettingsPage';

export type AdminAppContext = Record<string, never>;

const frameAdminSurface = defineAdminExtension<AdminAppContext>({
  routes: [
    { id: 'frame.dashboard', component: DashboardPage },
    { id: 'frame.modules', component: ModulesPage },
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
  navigation: [
    { id: 'frame.dashboard', icon: Gauge },
    { id: 'frame.modules', icon: Waypoints },
    { id: 'frame.access', icon: ShieldCheck },
    { id: 'frame.integrations', icon: PlugZap },
    { id: 'frame.assets', icon: Images },
    { id: 'frame.operations', icon: ListChecks },
    { id: 'frame.observability', icon: Activity },
    { id: 'frame.notifications', icon: Bell },
    { id: 'frame.metadata', icon: DatabaseZap },
    { id: 'frame.audit', icon: ScrollText },
    { id: 'frame.presentation', icon: Palette },
    { id: 'frame.settings', icon: Settings2 },
    { id: 'frame.help', icon: CircleHelp },
  ],
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

export const adminSystem = defineSystem({
  id: 'frame-reference-admin',
  version: FRAME_VERSION,
  extensions: [frameAdminDefinition, cmsAdminDefinition],
});

export const adminRegistry = createAdminRegistry<AdminAppContext>(adminSystem);

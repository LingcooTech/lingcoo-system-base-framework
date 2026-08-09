import { Settings2 } from 'lucide-react';

import { defineAdminExtension, type AdminExtensionSurface } from './index.js';
import { searchResources } from './defaults/client.js';
import { AccessPage } from './defaults/pages/AccessPage.js';
import { AccountPage } from './defaults/pages/AccountPage.js';
import { AssetsPage } from './defaults/pages/AssetsPage.js';
import { AuditPage } from './defaults/pages/AuditPage.js';
import { HelpPage } from './defaults/pages/HelpPage.js';
import { IntegrationsPage } from './defaults/pages/IntegrationsPage.js';
import { MetadataPage } from './defaults/pages/MetadataPage.js';
import { NotificationsPage } from './defaults/pages/NotificationsPage.js';
import { ObservabilityPage } from './defaults/pages/ObservabilityPage.js';
import { OperationsPage } from './defaults/pages/OperationsPage.js';
import { PresentationPage } from './defaults/pages/PresentationPage.js';
import { SettingsPage } from './defaults/pages/SettingsPage.js';
import { SystemInfoPage } from './defaults/pages/SystemInfoPage.js';

/**
 * Installs the complete Frame administration product into a Consumer registry.
 * Applications add their own routes beside this surface instead of copying the Reference Admin.
 */
export function createFrameAdminExtension<
  TContext = Record<string, never>,
>(): AdminExtensionSurface<TContext> {
  return defineAdminExtension<TContext>({
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
}

export * from './defaults/client.js';

import { FRAME_VERSION, type ExtensionManifest } from '@lingcootech/frame-extension-sdk';
import { frameAdminManifest, frameKernelAdminManifest } from '@lingcootech/frame-admin/manifest';
import { presentationManifest } from '@lingcootech/frame-presentation';
import { frameWebManifest } from '@lingcootech/frame-web/manifest';
import { frameIdentityManifest } from '@lingcootech/frame-identity';
import { jobsPermissions, jobsServerRoutes } from '@lingcootech/frame-jobs';
import {
  assetsPermissions,
  assetsServerRoutes,
  frameAssetsManifest,
} from '@lingcootech/frame-assets';
import { integrationsPermissions, integrationsServerRoutes } from '@lingcootech/frame-integrations';
import {
  frameNotificationsManifest,
  notificationsPermissions,
  notificationsServerRoutes,
} from '@lingcootech/frame-notifications';
import { basePermissions, kernelPermissions } from './modules/access/rbac.js';
import { legacyIntegrationAdapterRoutes } from './modules/integrations/index.js';

const frameSettings = [
  'general.system_name',
  'general.public_url',
  'general.support_email',
  'localization.default_locale',
  'localization.timezone',
] as const;

// Compatibility feature migrations. Identity owns its schema and is an explicit
// dependency of this source because several legacy features reference accounts.
const frameMigrations = [
  '0000_base_system.sql',
  '0001_platform_permissions.sql',
  '0005_governance.sql',
  '0006_metadata_exchange.sql',
  '0007_observability.sql',
] as const;

export { identityServerRoutes } from '@lingcootech/frame-identity';

export const frameKernelManifest = {
  id: 'frame',
  version: FRAME_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  permissions: kernelPermissions,
  settings: frameSettings,
  migrations: {
    sourceId: 'frame',
    migrations: frameMigrations.map((id) => ({ id, legacyAliases: [id] })),
  },
  admin: frameKernelAdminManifest,
} as const satisfies ExtensionManifest;

export { frameIdentityManifest } from '@lingcootech/frame-identity';

/**
 * Compatibility manifest for Consumers that still install the historical
 * all-in-one frameCoreExtension.
 */
export const frameCoreManifest = {
  ...frameKernelManifest,
  capabilities: frameIdentityManifest.capabilities,
  environment: frameIdentityManifest.environment,
  permissions: [
    ...basePermissions,
    ...assetsPermissions,
    ...integrationsPermissions,
    ...jobsPermissions,
    ...notificationsPermissions,
    ...presentationManifest.permissions,
  ],
  server: {
    routes: [
      ...frameIdentityManifest.server.routes,
      ...integrationsServerRoutes,
      ...jobsServerRoutes,
      ...notificationsServerRoutes,
      ...assetsServerRoutes,
      ...presentationManifest.server.routes,
      ...legacyIntegrationAdapterRoutes,
    ],
  },
  worker: {
    jobs: [...frameAssetsManifest.worker.jobs, ...frameNotificationsManifest.worker.jobs],
    subscriptions: frameNotificationsManifest.worker.subscriptions,
  },
  migrations: {
    sourceId: 'frame',
    migrations: [
      { id: '0000_identity.sql' },
      { id: '0001_jobs.sql' },
      { id: '0002_notifications.sql' },
      { id: '0003_integrations.sql' },
      { id: '0004_assets.sql' },
      ...frameMigrations.map((id) => ({ id, legacyAliases: [id] })),
      { id: '0008_presentation.sql', legacyAliases: ['0008_presentation.sql'] },
    ],
  },
  admin: frameAdminManifest,
  web: frameWebManifest,
} as const satisfies ExtensionManifest;

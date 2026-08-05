import { FRAME_VERSION, type ExtensionManifest } from '@lingcoo/frame-extension-sdk';
import { frameAdminManifest } from '@lingcoo/frame-admin/manifest';
import { frameWebManifest } from '@lingcoo/frame-web/manifest';

import { basePermissions } from '../lib/rbac.js';

const frameSettings = [
  'general.system_name',
  'general.public_url',
  'general.support_email',
  'localization.default_locale',
  'localization.timezone',
] as const;

const frameWorkerJobs = [
  'notification.email.deliver',
  'storage.asset.delete',
  'storage.asset.expire-upload',
  'cms.content.publish-scheduled',
] as const;

const frameMigrations = [
  '0000_base_system.sql',
  '0001_identity_access.sql',
  '0002_integration_foundation.sql',
  '0003_jobs_notifications.sql',
  '0004_storage_assets.sql',
  '0005_governance.sql',
  '0006_metadata_exchange.sql',
  '0007_observability.sql',
  '0008_presentation.sql',
  '0009_cms_lite.sql',
  '0010_account_security.sql',
  '0011_cms_workflow.sql',
] as const;

export const frameCoreManifest = {
  id: 'frame',
  version: FRAME_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  permissions: basePermissions,
  settings: frameSettings,
  worker: {
    jobs: frameWorkerJobs,
    subscriptions: ['auth.password_changed'],
  },
  migrations: {
    sourceId: 'frame',
    migrations: frameMigrations.map((id) => ({ id, legacyAliases: [id] })),
  },
  admin: frameAdminManifest,
  web: frameWebManifest,
} as const satisfies ExtensionManifest;

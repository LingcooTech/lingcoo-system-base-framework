import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcoo/frame-extension-sdk';
import { defineMigrationExtension } from '@lingcoo/frame-extension-sdk/migrations';
import { defineServerExtension } from '@lingcoo/frame-extension-sdk/server';
import { defineWorkerExtension } from '@lingcoo/frame-extension-sdk/worker';
import { frameMigrationSource, type Database } from '@lingcoo/frame-database';

import type { AppEnv } from '../lib/env.js';
import { assetDeleteJobPayloadSchema } from '../modules/assets/schemas.js';
import { AssetService } from '../modules/assets/service.js';
import { createIntegrationProviderRegistry } from '../modules/integrations/registry.js';
import { QiniuService } from '../modules/integrations/providers/qiniu-service.js';
import { IntegrationService } from '../modules/integrations/service.js';
import { appModules } from '../modules/index.js';
import { NotificationDeliveryService } from '../modules/notifications/delivery.js';
import { registerNotificationPolicies } from '../modules/notifications/policies.js';
import { NotificationService } from '../modules/notifications/service.js';
import { baseSettingDefinitions } from '../modules/settings/registry.js';
import { frameCoreManifest } from './manifest.js';
import { frameCmsExtension } from './cms.js';

const frameCoreServer = defineServerExtension({
  settings: baseSettingDefinitions,
  async register({ app }) {
    for (const appModule of appModules) await app.register(appModule.register);
  },
});

const frameCoreWorker = defineWorkerExtension<AppEnv, Database>({
  register(context) {
    const integrations = new IntegrationService(
      context.database,
      createIntegrationProviderRegistry(context.env.NODE_ENV),
      context.env.SETTINGS_ENCRYPTION_KEY,
    );
    const delivery = new NotificationDeliveryService(
      context.database,
      integrations,
      context.env.SETTINGS_ENCRYPTION_KEY,
    );
    const notifications = new NotificationService(context.database);
    const assets = new AssetService(context.database, new QiniuService(integrations));

    context.registerJob('notification.email.deliver', ({ payload }) =>
      delivery.deliverEmail(payload),
    );
    context.registerJob('storage.asset.delete', ({ payload }) =>
      assets.executeDelete(assetDeleteJobPayloadSchema.parse(payload).assetId),
    );
    context.registerJob('storage.asset.expire-upload', ({ payload }) =>
      assets.expireUpload(assetDeleteJobPayloadSchema.parse(payload).assetId),
    );
    registerNotificationPolicies(
      { subscribe: (topic, subscriber) => context.subscribe(topic, subscriber) },
      notifications,
    );
  },
});

const frameCoreMigrations = defineMigrationExtension(frameMigrationSource);

export const frameCoreExtension = defineExtension({
  manifest: frameCoreManifest,
  server: frameCoreServer,
  worker: frameCoreWorker,
  migrations: frameCoreMigrations,
});

export const defaultFrameSystem = defineSystem({
  id: 'frame-reference-system',
  version: FRAME_VERSION,
  extensions: [frameCoreExtension, frameCmsExtension],
});

export { frameCmsExtension } from './cms.js';

import { defineExtension, defineSystem, FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  defineMigrationExtension,
  defineMigrationSource,
} from '@lingcootech/frame-extension-sdk/migrations';
import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import { defineWorkerExtension } from '@lingcootech/frame-extension-sdk/worker';
import { frameMigrationSource, type Database } from '@lingcootech/frame-database';
import { assetsMigrationSource, createAssetsExtension } from '@lingcootech/frame-assets';
import {
  presentationMigrationSource,
  createPresentationExtension,
} from '@lingcootech/frame-presentation';
import {
  createIdentityExtension,
  DEFAULT_IDENTITY_ENVIRONMENT_ID,
  defaultIdentityEnvironment,
  identityMigrationSource,
} from '@lingcootech/frame-identity';
import {
  registerIdentityAccessRoutes,
  registerIdentityAuthRoutes,
} from '@lingcootech/frame-identity/server';
import { createJobsExtension, jobsMigrationSource } from '@lingcootech/frame-jobs';
import { registerJobsRoutes } from '@lingcootech/frame-jobs/server';
import {
  createIntegrationsExtension,
  integrationsMigrationSource,
} from '@lingcootech/frame-integrations';
import {
  createNotificationsExtension,
  notificationsMigrationSource,
} from '@lingcootech/frame-notifications';
import { registerNotificationsRoutes } from '@lingcootech/frame-notifications/server';
import {
  NotificationDeliveryService,
  NotificationService,
  createPasswordChangedSubscriber,
} from '@lingcootech/frame-notifications/worker';
import type { FastifyInstance } from 'fastify';
import { PostgresIdentityAccountDirectory } from '@lingcootech/frame-identity/postgres';

import type { AppEnv } from '../host/env.js';
import { SECURITY_PROVIDER_CAPABILITY } from '../host/security.js';
import { createCookieSessionSecurityProvider } from './modules/auth/provider.js';
import { baseDatasetAdapters } from './modules/data-exchange/adapters.js';
import { DatasetRegistry } from './modules/data-exchange/registry.js';
import { createIntegrationProviderRegistry } from './modules/integrations/registry.js';
import { appModules, kernelAppModules } from './modules/index.js';
import { installObservability } from './modules/observability/index.js';
import { MetricsRegistry } from './modules/observability/metrics.js';
import { ObservabilityService } from './modules/observability/service.js';
import { PublicSiteRegistry } from './modules/public-site/registry.js';
import { createBaseSearchProviders } from './modules/search/providers.js';
import { SearchProviderRegistry } from './modules/search/registry.js';
import { baseSettingDefinitions } from './modules/settings/registry.js';
import { frameCoreManifest, frameKernelManifest } from './manifest.js';
import { createLegacyIdentityPorts } from '../integrations/identity/ports.js';
import { createLegacyJobsPorts } from '../integrations/jobs/ports.js';
import { createLegacyNotificationsPorts } from '../integrations/notifications/ports.js';
import { createLegacyIntegrationsPorts } from '../integrations/integrations/ports.js';
import { createLegacyAssetsPorts } from '../integrations/assets/ports.js';
import { createLegacyPresentationPorts } from '../integrations/presentation/ports.js';
import { createLegacyAuditPort } from '../integrations/audit/ports.js';
import {
  legacyIntegrationAdapterRoutes,
  registerLegacyIntegrationAdapterRoutes,
} from './modules/integrations/index.js';

function installLegacyPlatformInfrastructure(app: Parameters<AppModuleRegister>[0]): void {
  const audit = createLegacyAuditPort(app.db);
  app.decorate('auditCommands', audit);

  const searchRegistry = new SearchProviderRegistry();
  const accountDirectory = new PostgresIdentityAccountDirectory(app.db);
  const integrationConnectionPort = createLegacyIntegrationsPorts(app.db).connections;
  for (const provider of createBaseSearchProviders(accountDirectory, integrationConnectionPort)) {
    searchRegistry.register(provider);
  }
  app.decorate('searchRegistry', searchRegistry);

  const datasetRegistry = new DatasetRegistry();
  for (const adapter of baseDatasetAdapters) datasetRegistry.register(adapter);
  app.decorate('datasetRegistry', datasetRegistry);

  app.decorate('publicSiteRegistry', new PublicSiteRegistry());
  app.decorate('observability', new ObservabilityService(app.db, new MetricsRegistry(), audit));
  installObservability(app);
}

type AppModuleRegister = (typeof appModules)[number]['register'];

const frameCoreServer = defineServerExtension<FastifyInstance>({
  settings: baseSettingDefinitions,
  capabilities: [
    {
      id: SECURITY_PROVIDER_CAPABILITY,
      value: createCookieSessionSecurityProvider(),
    },
  ],
  async register({ app }) {
    installLegacyPlatformInfrastructure(app);
    for (const appModule of appModules) await app.register(appModule.register);
    await framePresentationExtension.server?.register({ app: app as never });
    const ports = createLegacyIdentityPorts(app);
    await registerIdentityAuthRoutes(app, { environmentId: 'frame', ports });
    registerIdentityAccessRoutes(app, { ports });
    registerJobsRoutes(app, { ports: createLegacyJobsPorts(app) });
    registerNotificationsRoutes(app, {
      ports: createLegacyNotificationsPorts(app.db, app.appEnv),
    });
  },
});

const frameKernelServer = defineServerExtension<FastifyInstance>({
  settings: baseSettingDefinitions,
  async register({ app }) {
    installLegacyPlatformInfrastructure(app);
    for (const appModule of kernelAppModules) await app.register(appModule.register);
  },
});

const frameLegacyWorker = defineWorkerExtension<AppEnv, Database>({
  register(context) {
    frameAssetsExtension.worker?.register(context);
    const ports = createLegacyNotificationsPorts(context.database, context.env);
    const delivery = new NotificationDeliveryService(context.database, ports);
    const notifications = new NotificationService(context.database, ports);
    context.registerJob('notification.email.deliver', ({ payload }) =>
      delivery.deliverEmail(payload),
    );
    context.subscribe('auth.password_changed', createPasswordChangedSubscriber(notifications));
  },
});

const frameCoreMigrations = defineMigrationExtension(frameMigrationSource);
const frameLegacyMigrations = defineMigrationExtension(
  defineMigrationSource({
    id: 'frame',
    version: FRAME_VERSION,
    migrations: [
      { id: '0000_identity.sql', sql: identityMigrationSource.migrations[0]!.sql },
      { id: '0001_jobs.sql', sql: jobsMigrationSource.migrations[0]!.sql },
      { id: '0002_notifications.sql', sql: notificationsMigrationSource.migrations[0]!.sql },
      { id: '0003_integrations.sql', sql: integrationsMigrationSource.migrations[0]!.sql },
      { id: '0004_assets.sql', sql: assetsMigrationSource.migrations[0]!.sql },
      ...frameMigrationSource.migrations,
      {
        id: '0008_presentation.sql',
        sql: presentationMigrationSource.migrations[0]!.sql,
        legacyAliases: ['0008_presentation.sql', 'frame/0008_presentation.sql'],
      },
    ],
  }),
);

/** @deprecated Prefer the Kernel plus explicit Feature extensions. */
export const frameCoreExtension = defineExtension({
  manifest: frameCoreManifest,
  environment: defaultIdentityEnvironment,
  server: frameCoreServer,
  worker: frameLegacyWorker,
  migrations: frameLegacyMigrations,
});

export const frameKernelExtension = defineExtension({
  manifest: frameKernelManifest,
  server: frameKernelServer,
  migrations: frameCoreMigrations,
});

export const frameIdentityExtension = createIdentityExtension<FastifyInstance>({
  environmentId: DEFAULT_IDENTITY_ENVIRONMENT_ID,
  ports: createLegacyIdentityPorts,
});

export const frameJobsExtension = createJobsExtension({
  ports: createLegacyJobsPorts,
});

export const frameNotificationsExtension = createNotificationsExtension<AppEnv>({
  serverPorts: (app) => createLegacyNotificationsPorts(app.db, app.appEnv),
  workerPorts: (context) => createLegacyNotificationsPorts(context.database, context.env),
});

export const frameAssetsExtension = createAssetsExtension<AppEnv>({
  serverPorts: (app) => createLegacyAssetsPorts(app.db, app.appEnv),
  workerPorts: (context) => createLegacyAssetsPorts(context.database, context.env),
});

export const framePresentationExtension = createPresentationExtension({
  ports: (app) =>
    createLegacyPresentationPorts(app.db, createLegacyAssetsPorts(app.db, app.appEnv).references),
});

export const frameIntegrationsExtension = createIntegrationsExtension({
  registry: (app) => createIntegrationProviderRegistry(app.appEnv.NODE_ENV),
  ports: (app) => createLegacyIntegrationsPorts(app.db),
  registerAdditionalRoutes: registerLegacyIntegrationAdapterRoutes,
  additionalRoutes: legacyIntegrationAdapterRoutes,
});

export const frameCoreSystem = defineSystem({
  id: 'frame-core-system',
  version: FRAME_VERSION,
  extensions: [
    frameKernelExtension,
    frameIdentityExtension,
    frameIntegrationsExtension,
    frameJobsExtension,
    frameAssetsExtension,
    framePresentationExtension,
    frameNotificationsExtension,
  ],
});

export const frameLegacyCoreSystem = defineSystem({
  id: 'frame-legacy-core-system',
  version: FRAME_VERSION,
  extensions: [frameCoreExtension],
});

import {
  IntegrationService,
  registerIntegrationsRoutes,
} from '@lingcootech/frame-integrations/server';
import type { FastifyInstance } from 'fastify';
import {
  openRouterAdapterRoutes,
  registerOpenRouterAdapterRoutes,
} from '@lingcootech/frame-ai-openrouter';
import { registerSmtpAdapterRoutes, smtpAdapterRoutes } from '@lingcootech/frame-mail-nodemailer';
import { qiniuAdapterRoutes, registerQiniuAdapterRoutes } from '@lingcootech/frame-storage-qiniu';

import { createLegacyIntegrationsPorts } from '../../../integrations/integrations/ports.js';
import type { AppModule } from '../types.js';
import { createIntegrationProviderRegistry } from './registry.js';

export const legacyIntegrationAdapterRoutes = [
  ...smtpAdapterRoutes,
  ...qiniuAdapterRoutes,
  ...openRouterAdapterRoutes,
] as const;

export function registerLegacyIntegrationAdapterRoutes(
  app: FastifyInstance,
  service: IntegrationService,
): void {
  registerSmtpAdapterRoutes(app, service);
  registerQiniuAdapterRoutes(app, service);
  registerOpenRouterAdapterRoutes(app, service);
}

/** Compatibility module for the historical all-in-one Frame extension. */
export const integrationsModule: AppModule = {
  name: 'integrations',
  register(app) {
    const service = new IntegrationService(
      app.db,
      createIntegrationProviderRegistry(app.appEnv.NODE_ENV),
      app.appEnv.SETTINGS_ENCRYPTION_KEY,
      createLegacyIntegrationsPorts(app.db),
    );
    registerIntegrationsRoutes(app, service);
    registerLegacyIntegrationAdapterRoutes(app, service);
  },
};

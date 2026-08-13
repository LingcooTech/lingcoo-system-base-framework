import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FrameFastifyInstance } from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';

import { resolveIntegrationsDatabase } from './database.js';
import {
  DEFAULT_INTEGRATIONS_ENVIRONMENT_ID,
  type IntegrationsEnvironment,
} from './environment.js';
import { createNoopIntegrationsPorts, type IntegrationsPorts } from './ports.js';
import { IntegrationProviderRegistry } from './provider.js';
import { registerIntegrationsRoutes } from './routes.js';
import { IntegrationService } from './service.js';

export type IntegrationsPortsFactory = (
  app: FastifyInstance,
) => IntegrationsPorts | Promise<IntegrationsPorts>;
export type IntegrationProviderRegistryFactory = (
  app: FastifyInstance,
) => IntegrationProviderRegistry | Promise<IntegrationProviderRegistry>;
export type IntegrationsAdditionalRoutes = (
  app: FastifyInstance,
  service: IntegrationService,
) => void | Promise<void>;

export interface CreateIntegrationsServerOptions {
  environmentId?: string;
  ports?: IntegrationsPorts | IntegrationsPortsFactory;
  registry?: IntegrationProviderRegistry | IntegrationProviderRegistryFactory;
  registerAdditionalRoutes?: IntegrationsAdditionalRoutes;
}

export function createIntegrationsServerExtension(options: CreateIntegrationsServerOptions = {}) {
  return defineServerExtension<FrameFastifyInstance>({
    async register({ app }) {
      const environment =
        app.frameKernel?.environment ??
        (
          app as FastifyInstance & {
            environment?: { require<T>(id: string): T };
          }
        ).environment;
      if (!environment) throw new Error('Integrations requires the System environment registry');
      const values = environment.require<IntegrationsEnvironment>(
        options.environmentId ?? DEFAULT_INTEGRATIONS_ENVIRONMENT_ID,
      );
      const configuredPorts = options.ports ?? createNoopIntegrationsPorts();
      const ports =
        typeof configuredPorts === 'function' ? await configuredPorts(app) : configuredPorts;
      const configuredRegistry = options.registry ?? new IntegrationProviderRegistry();
      const registry =
        typeof configuredRegistry === 'function'
          ? await configuredRegistry(app)
          : configuredRegistry;
      const service = new IntegrationService(
        resolveIntegrationsDatabase(app),
        registry,
        values.SETTINGS_ENCRYPTION_KEY,
        ports,
      );
      registerIntegrationsRoutes(app, service);
      await options.registerAdditionalRoutes?.(app, service);
    },
  });
}

export { registerIntegrationsRoutes } from './routes.js';
export { IntegrationService } from './service.js';

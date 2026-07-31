import type { AppModule } from '../types.js';
import { createIntegrationProviderRegistry } from './registry.js';
import {
  connectionParamsSchema,
  createConnectionSchema,
  updateConnectionSchema,
} from './schemas.js';
import { IntegrationService } from './service.js';

export const integrationsModule: AppModule = {
  name: 'integrations',
  register(app) {
    const registry = createIntegrationProviderRegistry(app.appEnv.NODE_ENV);
    const service = new IntegrationService(app.db, registry, app.appEnv.SETTINGS_ENCRYPTION_KEY);

    app.get(
      '/api/integrations/providers',
      { preHandler: app.requirePermission('integrations.read') },
      async () => ({ items: service.listProviders() }),
    );

    app.get(
      '/api/integrations/connections',
      { preHandler: app.requirePermission('integrations.read') },
      async () => ({ items: await service.listConnections() }),
    );

    app.post(
      '/api/integrations/connections',
      { preHandler: app.requirePermission('integrations.write') },
      async (request, reply) => {
        const connection = await service.createConnection(
          createConnectionSchema.parse(request.body),
          request.auth!.accountId,
        );
        return reply.code(201).send({ connection });
      },
    );

    app.patch(
      '/api/integrations/connections/:connectionId',
      { preHandler: app.requirePermission('integrations.write') },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        const connection = await service.updateConnection(
          connectionId,
          updateConnectionSchema.parse(request.body),
          request.auth!.accountId,
        );
        return { connection };
      },
    );

    app.post(
      '/api/integrations/connections/:connectionId/test',
      {
        preHandler: app.requirePermission('integrations.write'),
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        return { result: await service.testConnection(connectionId, request.auth!.accountId) };
      },
    );

    app.get(
      '/api/integrations/connections/:connectionId/events',
      { preHandler: app.requirePermission('integrations.read') },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        return { items: await service.listEvents(connectionId) };
      },
    );
  },
};

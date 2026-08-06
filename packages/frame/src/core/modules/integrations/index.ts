import type { AppModule } from '../types.js';
import { createIntegrationProviderRegistry } from './registry.js';
import { OpenRouterService } from './providers/openrouter-service.js';
import { QiniuService } from './providers/qiniu-service.js';
import { SmtpService } from './providers/smtp-service.js';
import {
  connectionParamsSchema,
  createConnectionSchema,
  openRouterChatSchema,
  qiniuObjectKeySchema,
  qiniuObjectListSchema,
  qiniuSignedAccessSchema,
  smtpTestEmailSchema,
  updateConnectionSchema,
} from './schemas.js';
import { IntegrationService } from './service.js';

export const integrationsModule: AppModule = {
  name: 'integrations',
  register(app) {
    const registry = createIntegrationProviderRegistry(app.appEnv.NODE_ENV);
    const service = new IntegrationService(app.db, registry, app.appEnv.SETTINGS_ENCRYPTION_KEY);
    const smtpService = new SmtpService(service);
    const qiniuService = new QiniuService(service);
    const openRouterService = new OpenRouterService(service);

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

    app.post(
      '/api/integrations/connections/:connectionId/smtp/send-test',
      {
        preHandler: app.requirePermission('integrations.write'),
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        const result = await smtpService.sendTestEmail(
          connectionId,
          smtpTestEmailSchema.parse(request.body),
          request.auth!.accountId,
        );
        return { result };
      },
    );

    app.get(
      '/api/integrations/connections/:connectionId/qiniu/objects',
      {
        preHandler: app.requirePermission('integrations.read'),
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        const result = await qiniuService.listObjects(
          connectionId,
          qiniuObjectListSchema.parse(request.query),
          request.auth!.accountId,
        );
        return result;
      },
    );

    app.post(
      '/api/integrations/connections/:connectionId/qiniu/upload-token',
      {
        preHandler: app.requirePermission('integrations.write'),
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        return {
          result: await qiniuService.createUploadToken(
            connectionId,
            qiniuSignedAccessSchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );

    app.post(
      '/api/integrations/connections/:connectionId/qiniu/private-url',
      {
        preHandler: app.requirePermission('integrations.read'),
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        return {
          result: await qiniuService.createPrivateUrl(
            connectionId,
            qiniuSignedAccessSchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );

    app.delete(
      '/api/integrations/connections/:connectionId/qiniu/object',
      {
        preHandler: app.requirePermission('integrations.write'),
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        const { key } = qiniuObjectKeySchema.parse(request.body);
        return {
          result: await qiniuService.deleteObject(connectionId, key, request.auth!.accountId),
        };
      },
    );

    app.get(
      '/api/integrations/connections/:connectionId/openrouter/models',
      {
        preHandler: app.requirePermission('integrations.read'),
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        return {
          items: await openRouterService.listModels(connectionId, request.auth!.accountId),
        };
      },
    );

    app.post(
      '/api/integrations/connections/:connectionId/openrouter/chat-test',
      {
        preHandler: app.requirePermission('integrations.write'),
        config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      },
      async (request) => {
        const { connectionId } = connectionParamsSchema.parse(request.params);
        return {
          result: await openRouterService.chat(
            connectionId,
            openRouterChatSchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );
  },
};

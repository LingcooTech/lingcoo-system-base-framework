import type { AppModule } from '../types.js';
import { createIntegrationProviderRegistry } from '../integrations/registry.js';
import { QiniuService } from '../integrations/providers/qiniu-service.js';
import { IntegrationService } from '../integrations/service.js';
import {
  assetListSchema,
  assetParamsSchema,
  assetReferenceParamsSchema,
  createAssetReferenceSchema,
  createUploadIntentSchema,
  updateAssetSchema,
} from './schemas.js';
import { AssetService } from './service.js';

export const assetsModule: AppModule = {
  name: 'assets',
  register(app) {
    const integrations = new IntegrationService(
      app.db,
      createIntegrationProviderRegistry(app.appEnv.NODE_ENV),
      app.appEnv.SETTINGS_ENCRYPTION_KEY,
    );
    const service = new AssetService(app.db, new QiniuService(integrations));

    app.get('/api/assets', { preHandler: app.requirePermission('assets.read') }, async (request) =>
      service.list(assetListSchema.parse(request.query)),
    );
    app.get('/api/assets/summary', { preHandler: app.requirePermission('assets.read') }, async () =>
      service.summary(),
    );
    app.post(
      '/api/assets/upload-intents',
      {
        preHandler: app.requirePermission('assets.write'),
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      },
      async (request, reply) => {
        const result = await service.createUploadIntent(
          createUploadIntentSchema.parse(request.body),
          request.auth!.accountId,
        );
        return reply.code(201).send(result);
      },
    );
    app.post(
      '/api/assets/:assetId/complete',
      { preHandler: app.requirePermission('assets.write') },
      async (request) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        return { asset: await service.confirmUpload(assetId, request.auth!.accountId) };
      },
    );
    app.get(
      '/api/assets/:assetId/access-url',
      { preHandler: app.requirePermission('assets.read') },
      async (request) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        return { result: await service.getAccessUrl(assetId, request.auth!.accountId) };
      },
    );
    app.patch(
      '/api/assets/:assetId',
      { preHandler: app.requirePermission('assets.write') },
      async (request) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        return {
          asset: await service.update(
            assetId,
            updateAssetSchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );
    app.post(
      '/api/assets/:assetId/archive',
      { preHandler: app.requirePermission('assets.manage') },
      async (request) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        return { asset: await service.setArchived(assetId, true, request.auth!.accountId) };
      },
    );
    app.post(
      '/api/assets/:assetId/restore',
      { preHandler: app.requirePermission('assets.manage') },
      async (request) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        return { asset: await service.setArchived(assetId, false, request.auth!.accountId) };
      },
    );
    app.delete(
      '/api/assets/:assetId',
      { preHandler: app.requirePermission('assets.manage') },
      async (request, reply) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        const result = await service.requestDelete(assetId, request.auth!.accountId);
        return reply.code(202).send({ result });
      },
    );
    app.get(
      '/api/assets/:assetId/references',
      { preHandler: app.requirePermission('assets.read') },
      async (request) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        return { items: await service.listReferences(assetId) };
      },
    );
    app.post(
      '/api/assets/:assetId/references',
      { preHandler: app.requirePermission('assets.write') },
      async (request, reply) => {
        const { assetId } = assetParamsSchema.parse(request.params);
        const reference = await service.linkReference(
          assetId,
          createAssetReferenceSchema.parse(request.body),
          request.auth!.accountId,
        );
        return reply.code(201).send({ reference });
      },
    );
    app.delete(
      '/api/assets/:assetId/references/:referenceId',
      { preHandler: app.requirePermission('assets.write') },
      async (request) => {
        const { assetId, referenceId } = assetReferenceParamsSchema.parse(request.params);
        await service.unlinkReference(assetId, referenceId, request.auth!.accountId);
        return { ok: true };
      },
    );
  },
};

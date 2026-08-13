import type { FastifyInstance } from 'fastify';

import { resolveAssetsDatabase } from './database.js';
import type { AssetsPorts } from './ports.js';
import {
  assetListSchema,
  assetParamsSchema,
  assetReferenceParamsSchema,
  createAssetReferenceSchema,
  createUploadIntentSchema,
  updateAssetSchema,
} from './schemas.js';
import { AssetService } from './service.js';

export function registerAssetsRoutes(app: FastifyInstance, options: { ports: AssetsPorts }): void {
  const service = new AssetService(resolveAssetsDatabase(app), options.ports);

  app.get('/api/assets', { preHandler: app.requirePermission('assets.read') }, async (request) =>
    service.list(assetListSchema.parse(request.query)),
  );
  app.get('/api/assets/summary', { preHandler: app.requirePermission('assets.read') }, async () =>
    service.summary(),
  );
  app.get(
    '/api/assets/storage-connections',
    {
      preHandler: app.requirePermission('assets.read'),
    },
    async () => ({ items: await options.ports.storage.listConnections() }),
  );
  app.post(
    '/api/assets/upload-intents',
    {
      preHandler: app.requirePermission('assets.write'),
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) =>
      reply
        .code(201)
        .send(
          await service.createUploadIntent(
            createUploadIntentSchema.parse(request.body),
            request.auth!.accountId,
          ),
        ),
  );
  app.post(
    '/api/assets/:assetId/complete',
    {
      preHandler: app.requirePermission('assets.write'),
    },
    async (request) => ({
      asset: await service.confirmUpload(
        assetParamsSchema.parse(request.params).assetId,
        request.auth!.accountId,
      ),
    }),
  );
  app.get(
    '/api/assets/:assetId/access-url',
    {
      preHandler: app.requirePermission('assets.read'),
    },
    async (request) => ({
      result: await service.getAccessUrl(
        assetParamsSchema.parse(request.params).assetId,
        request.auth!.accountId,
      ),
    }),
  );
  app.patch(
    '/api/assets/:assetId',
    {
      preHandler: app.requirePermission('assets.write'),
    },
    async (request) => ({
      asset: await service.update(
        assetParamsSchema.parse(request.params).assetId,
        updateAssetSchema.parse(request.body),
        request.auth!.accountId,
      ),
    }),
  );
  app.post(
    '/api/assets/:assetId/archive',
    {
      preHandler: app.requirePermission('assets.manage'),
    },
    async (request) => ({
      asset: await service.setArchived(
        assetParamsSchema.parse(request.params).assetId,
        true,
        request.auth!.accountId,
      ),
    }),
  );
  app.post(
    '/api/assets/:assetId/restore',
    {
      preHandler: app.requirePermission('assets.manage'),
    },
    async (request) => ({
      asset: await service.setArchived(
        assetParamsSchema.parse(request.params).assetId,
        false,
        request.auth!.accountId,
      ),
    }),
  );
  app.delete(
    '/api/assets/:assetId',
    {
      preHandler: app.requirePermission('assets.manage'),
    },
    async (request, reply) =>
      reply.code(202).send({
        result: await service.requestDelete(
          assetParamsSchema.parse(request.params).assetId,
          request.auth!.accountId,
        ),
      }),
  );
  app.get(
    '/api/assets/:assetId/references',
    {
      preHandler: app.requirePermission('assets.read'),
    },
    async (request) => ({
      items: await service.listReferences(assetParamsSchema.parse(request.params).assetId),
    }),
  );
  app.post(
    '/api/assets/:assetId/references',
    {
      preHandler: app.requirePermission('assets.write'),
    },
    async (request, reply) =>
      reply.code(201).send({
        reference: await service.linkReference(
          assetParamsSchema.parse(request.params).assetId,
          createAssetReferenceSchema.parse(request.body),
          request.auth!.accountId,
        ),
      }),
  );
  app.delete(
    '/api/assets/:assetId/references/:referenceId',
    {
      preHandler: app.requirePermission('assets.write'),
    },
    async (request) => {
      const { assetId, referenceId } = assetReferenceParamsSchema.parse(request.params);
      await service.unlinkReference(assetId, referenceId, request.auth!.accountId);
      return { ok: true };
    },
  );
}

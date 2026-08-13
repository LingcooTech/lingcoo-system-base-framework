import type { IntegrationService } from '@lingcootech/frame-integrations';
import type {} from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { QiniuService } from './service.js';

const connectionParamsSchema = z.object({ connectionId: z.uuid() });
const objectKey = z.string().trim().min(1).max(1024);
const qiniuObjectListSchema = z.object({
  prefix: z.string().trim().max(512).optional(),
  marker: z.string().trim().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});
const qiniuObjectKeySchema = z.object({ key: objectKey });
const qiniuSignedAccessSchema = z.object({
  key: objectKey,
  expiresInSeconds: z.number().int().min(60).max(86_400).optional(),
});

export const qiniuAdapterRoutes = [
  { method: 'GET', path: '/api/integrations/connections/:connectionId/qiniu/objects' },
  { method: 'POST', path: '/api/integrations/connections/:connectionId/qiniu/upload-token' },
  { method: 'POST', path: '/api/integrations/connections/:connectionId/qiniu/private-url' },
  { method: 'DELETE', path: '/api/integrations/connections/:connectionId/qiniu/object' },
] as const;

export function registerQiniuAdapterRoutes(
  app: FastifyInstance,
  integrations: IntegrationService,
): void {
  const service = new QiniuService(integrations);

  app.get(
    '/api/integrations/connections/:connectionId/qiniu/objects',
    {
      preHandler: app.requirePermission('integrations.read'),
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { connectionId } = connectionParamsSchema.parse(request.params);
      return service.listObjects(
        connectionId,
        qiniuObjectListSchema.parse(request.query),
        request.auth!.accountId,
      );
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
        result: await service.createUploadToken(
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
        result: await service.createPrivateUrl(
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
        result: await service.deleteObject(connectionId, key, request.auth!.accountId),
      };
    },
  );
}

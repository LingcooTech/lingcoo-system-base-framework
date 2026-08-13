import type { IntegrationService } from '@lingcootech/frame-integrations';
import type {} from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { OpenRouterService } from './service.js';

const connectionParamsSchema = z.object({ connectionId: z.uuid() });
const openRouterChatSchema = z.object({
  model: z.string().trim().min(1).max(200).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().trim().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(40),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
});

export const openRouterAdapterRoutes = [
  { method: 'GET', path: '/api/integrations/connections/:connectionId/openrouter/models' },
  { method: 'POST', path: '/api/integrations/connections/:connectionId/openrouter/chat-test' },
] as const;

export function registerOpenRouterAdapterRoutes(
  app: FastifyInstance,
  integrations: IntegrationService,
): void {
  const service = new OpenRouterService(integrations);

  app.get(
    '/api/integrations/connections/:connectionId/openrouter/models',
    {
      preHandler: app.requirePermission('integrations.read'),
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { connectionId } = connectionParamsSchema.parse(request.params);
      return { items: await service.listModels(connectionId, request.auth!.accountId) };
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
        result: await service.chat(
          connectionId,
          openRouterChatSchema.parse(request.body),
          request.auth!.accountId,
        ),
      };
    },
  );
}

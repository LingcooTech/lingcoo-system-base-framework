import type { IntegrationService } from '@lingcootech/frame-integrations';
import type {} from '@lingcootech/frame-fastify';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { SmtpService } from './service.js';

const connectionParamsSchema = z.object({ connectionId: z.uuid() });
const smtpTestEmailSchema = z.object({
  to: z.email().max(254),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(5000),
});

export const smtpAdapterRoutes = [
  { method: 'POST', path: '/api/integrations/connections/:connectionId/smtp/send-test' },
] as const;

export function registerSmtpAdapterRoutes(
  app: FastifyInstance,
  integrations: IntegrationService,
): void {
  const service = new SmtpService(integrations);
  app.post(
    '/api/integrations/connections/:connectionId/smtp/send-test',
    {
      preHandler: app.requirePermission('integrations.write'),
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request) => {
      const { connectionId } = connectionParamsSchema.parse(request.params);
      return {
        result: await service.sendTestEmail(
          connectionId,
          smtpTestEmailSchema.parse(request.body),
          request.auth!.accountId,
        ),
      };
    },
  );
}

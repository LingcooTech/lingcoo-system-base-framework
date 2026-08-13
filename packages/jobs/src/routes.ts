import type { FastifyInstance } from 'fastify';
import { OutboxService } from './outbox.js';
import { jobListSchema, jobParamsSchema, outboxListSchema } from './schemas.js';
import { JobService } from './service.js';
import { resolveJobsDatabase } from './database.js';
import { createNoopJobsPorts, type JobsPorts } from './ports.js';

export interface RegisterJobsRoutesOptions {
  ports?: JobsPorts;
}

export function registerJobsRoutes(
  app: FastifyInstance,
  options: RegisterJobsRoutesOptions = {},
): void {
  const database = resolveJobsDatabase(app);
  const jobs = new JobService(database, options.ports ?? createNoopJobsPorts());
  const outbox = new OutboxService(database);

  app.get('/api/jobs', { preHandler: app.requirePermission('jobs.read') }, async (request) =>
    jobs.list(jobListSchema.parse(request.query)),
  );
  app.get('/api/jobs/summary', { preHandler: app.requirePermission('jobs.read') }, async () => ({
    counts: await jobs.summary(),
  }));
  app.post(
    '/api/jobs/:jobId/retry',
    { preHandler: app.requirePermission('jobs.write') },
    async (request) => {
      const { jobId } = jobParamsSchema.parse(request.params);
      await jobs.retry(jobId, request.auth!.accountId);
      return { ok: true };
    },
  );
  app.post(
    '/api/jobs/:jobId/cancel',
    { preHandler: app.requirePermission('jobs.write') },
    async (request) => {
      const { jobId } = jobParamsSchema.parse(request.params);
      await jobs.cancel(jobId, request.auth!.accountId);
      return { ok: true };
    },
  );
  app.get('/api/jobs/outbox', { preHandler: app.requirePermission('jobs.read') }, async (request) =>
    outbox.list(outboxListSchema.parse(request.query)),
  );
}

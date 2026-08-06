import type { AppModule } from '../types.js';
import { OutboxService } from './outbox.js';
import { jobListSchema, jobParamsSchema, outboxListSchema } from './schemas.js';
import { JobService } from './service.js';

export const jobsModule: AppModule = {
  name: 'jobs',
  register(app) {
    const jobs = new JobService(app.db);
    const outbox = new OutboxService(app.db);

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
    app.get(
      '/api/jobs/outbox',
      { preHandler: app.requirePermission('jobs.read') },
      async (request) => outbox.list(outboxListSchema.parse(request.query)),
    );
  },
};

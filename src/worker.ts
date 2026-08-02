import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

import { createDatabase } from './db/client.js';
import { recordAuditEvent } from './lib/audit.js';
import { loadEnv } from './lib/env.js';
import { createIntegrationProviderRegistry } from './modules/integrations/registry.js';
import { QiniuService } from './modules/integrations/providers/qiniu-service.js';
import { IntegrationService } from './modules/integrations/service.js';
import { OutboxService } from './modules/jobs/outbox.js';
import { JobHandlerRegistry, OutboxSubscriberRegistry } from './modules/jobs/registry.js';
import { JobService } from './modules/jobs/service.js';
import { NotificationDeliveryService } from './modules/notifications/delivery.js';
import { registerNotificationPolicies } from './modules/notifications/policies.js';
import { NotificationService } from './modules/notifications/service.js';
import { assetDeleteJobPayloadSchema } from './modules/assets/schemas.js';
import { AssetService } from './modules/assets/service.js';

const env = loadEnv();
const workerId = `worker_${randomUUID()}`;
const { db, pool } = createDatabase(env.DATABASE_URL);
const jobs = new JobService(db);
const outbox = new OutboxService(db);
const jobHandlers = new JobHandlerRegistry();
const subscribers = new OutboxSubscriberRegistry();
const integrations = new IntegrationService(
  db,
  createIntegrationProviderRegistry(env.NODE_ENV),
  env.SETTINGS_ENCRYPTION_KEY,
);
const delivery = new NotificationDeliveryService(db, integrations);
const notifications = new NotificationService(db);
const assets = new AssetService(db, new QiniuService(integrations));
jobHandlers.register('notification.email.deliver', ({ payload }) => delivery.deliverEmail(payload));
jobHandlers.register('storage.asset.delete', ({ payload }) =>
  assets.executeDelete(assetDeleteJobPayloadSchema.parse(payload).assetId),
);
jobHandlers.register('storage.asset.expire-upload', ({ payload }) =>
  assets.expireUpload(assetDeleteJobPayloadSchema.parse(payload).assetId),
);
registerNotificationPolicies(subscribers, notifications);

let stopping = false;
let lastLoopAt = new Date();
let lastRecoveryAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const healthServer = createServer((_request, response) => {
  const fresh = Date.now() - lastLoopAt.getTime() < env.WORKER_STALE_TIMEOUT_MS;
  const healthy = !stopping && fresh;
  response.writeHead(healthy ? 200 : 503, { 'Content-Type': 'application/json' });
  response.end(
    JSON.stringify({
      status: stopping ? 'stopping' : fresh ? 'ok' : 'stale',
      workerId,
      lastLoopAt: lastLoopAt.toISOString(),
    }),
  );
});

async function recoverStaleWork() {
  if (Date.now() - lastRecoveryAt < 60_000) return;
  lastRecoveryAt = Date.now();
  const [jobCount, eventCount] = await Promise.all([
    jobs.recoverStale(env.WORKER_STALE_TIMEOUT_MS, workerId),
    outbox.recoverStale(env.WORKER_STALE_TIMEOUT_MS),
  ]);
  if (jobCount + eventCount > 0) {
    console.warn('[worker] recovered stale work', { jobCount, eventCount });
  }
}

async function processOutbox(): Promise<boolean> {
  const event = await outbox.claimNext(workerId);
  if (!event) return false;
  try {
    await subscribers.dispatch({
      eventId: event.id,
      topic: event.topic,
      payload: event.payload,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
    });
    await outbox.markPublished(event.id);
  } catch (error) {
    await outbox.markFailed(event, error);
    console.error('[worker] outbox dispatch failed', {
      eventId: event.id,
      topic: event.topic,
      error,
    });
  }
  return true;
}

async function processJob(): Promise<boolean> {
  const job = await jobs.claimNext(workerId);
  if (!job) return false;
  try {
    const result = await jobHandlers.execute(job.kind, {
      jobId: job.id,
      payload: job.payload,
      signal: AbortSignal.timeout(60_000),
    });
    await jobs.markSucceeded(job.id, result);
    await recordAuditEvent(db, {
      action: 'job.succeeded',
      resourceType: 'job_run',
      resourceId: job.id,
      metadata: { kind: job.kind, attempts: job.attempts, workerId },
    });
  } catch (error) {
    const status = await jobs.markFailed(job, error);
    await recordAuditEvent(db, {
      action: status === 'dead' ? 'job.dead' : 'job.retry_scheduled',
      resourceType: 'job_run',
      resourceId: job.id,
      metadata: {
        kind: job.kind,
        attempts: job.attempts,
        workerId,
        error: (error instanceof Error ? error.message : 'Unknown job error').slice(0, 500),
      },
    });
    console.error('[worker] job failed', { jobId: job.id, kind: job.kind, status, error });
  }
  return true;
}

async function main() {
  await new Promise<void>((resolve, reject) => {
    healthServer.once('error', reject);
    healthServer.listen(env.WORKER_HEALTH_PORT, env.API_HOST, () => resolve());
  });
  console.log(`[worker] started ${workerId}`);
  while (!stopping) {
    lastLoopAt = new Date();
    await recoverStaleWork();
    const worked = (await processOutbox()) || (await processJob());
    if (!worked) await sleep(env.WORKER_POLL_INTERVAL_MS);
  }
}

function requestShutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[worker] stopping on ${signal}`);
  healthServer.close();
}

process.on('SIGTERM', () => requestShutdown('SIGTERM'));
process.on('SIGINT', () => requestShutdown('SIGINT'));

main()
  .catch((error) => {
    console.error('[worker] startup failed', error);
    process.exitCode = 1;
    requestShutdown('startup-error');
  })
  .finally(() => pool.end());

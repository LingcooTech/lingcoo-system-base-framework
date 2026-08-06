import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

import { createDatabase } from '@lingcoo/frame-database';
import type { DefinedSystem } from '@lingcoo/frame-extension-sdk';

import { frameCoreSystem } from '../core/extension.js';
import { recordAuditEvent } from '../core/modules/audit/recorder.js';
import { OutboxService } from '../core/modules/jobs/outbox.js';
import { JobHandlerRegistry, OutboxSubscriberRegistry } from '../core/modules/jobs/registry.js';
import { JobService } from '../core/modules/jobs/service.js';
import { MetricsRegistry } from '../core/modules/observability/metrics.js';
import { ObservabilityService } from '../core/modules/observability/service.js';
import type { AppEnv } from '../host/env.js';
import { serializeSafeError, writeServiceLog } from '../host/logging.js';
import { assertFrameSystemCompatibility, registerSystemWorkerExtensions } from './extensions.js';

export interface FrameWorkerStatus {
  id: string;
  state: 'idle' | 'running' | 'stopping' | 'stopped';
  lastLoopAt: Date;
  extensions: string[];
  jobKinds: string[];
  eventTopics: string[];
}

export interface FrameWorker {
  readonly id: string;
  run(): Promise<void>;
  stop(signal?: string): Promise<void>;
  dispose(): Promise<void>;
  getStatus(): FrameWorkerStatus;
}

export interface CreateFrameWorkerOptions {
  system?: DefinedSystem;
}

export function createFrameWorker(
  env: AppEnv,
  options: CreateFrameWorkerOptions = {},
): FrameWorker {
  const system = options.system ?? frameCoreSystem;
  assertFrameSystemCompatibility(system);
  const workerId = `worker_${randomUUID()}`;
  const workerStartedAt = new Date();
  const { db, pool } = createDatabase(env.DATABASE_URL);
  const jobs = new JobService(db);
  const outbox = new OutboxService(db);
  const jobHandlers = new JobHandlerRegistry();
  const subscribers = new OutboxSubscriberRegistry();
  const observability = new ObservabilityService(db, new MetricsRegistry());
  const redactionSecrets = [
    env.AUTH_JWT_SECRET,
    env.SETTINGS_ENCRYPTION_KEY,
    env.AUTH_BOOTSTRAP_PASSWORD,
    env.METRICS_BEARER_TOKEN,
  ];
  try {
    registerSystemWorkerExtensions({
      system,
      env,
      database: db,
      jobHandlers,
      subscribers,
    });
  } catch (error) {
    void pool.end();
    throw error;
  }

  let stopping = false;
  let running = false;
  let disposed = false;
  let lastLoopAt = new Date();
  let lastRecoveryAt = 0;
  let heartbeatTimer: NodeJS.Timeout | undefined;
  let healthClosePromise: Promise<void> | undefined;
  let runCompletion: Promise<void> | undefined;

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
      writeServiceLog('warn', 'worker', 'stale_work_recovered', {
        instanceId: workerId,
        jobCount,
        eventCount,
      });
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
      const safeError = serializeSafeError(error, redactionSecrets);
      await outbox.markFailed(event, new Error(safeError.message));
      await observability
        .captureIncident({
          category: 'worker_error',
          serviceType: 'worker',
          error,
          route: `outbox:${event.topic}`,
        })
        .catch(() => undefined);
      writeServiceLog('error', 'worker', 'outbox_dispatch_failed', {
        instanceId: workerId,
        eventId: event.id,
        topic: event.topic,
        error: safeError,
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
      const safeError = serializeSafeError(error, redactionSecrets);
      const status = await jobs.markFailed(job, new Error(safeError.message));
      await recordAuditEvent(db, {
        action: status === 'dead' ? 'job.dead' : 'job.retry_scheduled',
        resourceType: 'job_run',
        resourceId: job.id,
        metadata: {
          kind: job.kind,
          attempts: job.attempts,
          workerId,
          errorName: safeError.name,
          errorMessage: safeError.message.slice(0, 500),
        },
      });
      await observability
        .captureIncident({
          category: 'worker_error',
          serviceType: 'worker',
          error,
          route: `job:${job.kind}`,
          severity: status === 'dead' ? 'critical' : 'error',
        })
        .catch(() => undefined);
      writeServiceLog('error', 'worker', 'job_failed', {
        instanceId: workerId,
        jobId: job.id,
        kind: job.kind,
        status,
        error: safeError,
      });
    }
    return true;
  }

  async function closeHealthServer(): Promise<void> {
    if (healthClosePromise) return healthClosePromise;
    if (!healthServer.listening) return;
    healthClosePromise = new Promise<void>((resolve, reject) => {
      healthServer.close((error) => (error ? reject(error) : resolve()));
    });
    return healthClosePromise;
  }

  async function execute(): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        healthServer.once('error', reject);
        healthServer.listen(env.WORKER_HEALTH_PORT, env.API_HOST, () => resolve());
      });
      const sendHeartbeat = (status: 'healthy' | 'stopping' | 'degraded' = 'healthy') =>
        observability.heartbeat({
          serviceType: 'worker',
          instanceId: workerId,
          version: env.APP_VERSION,
          status,
          startedAt: workerStartedAt,
          metadata: { lastLoopAt: lastLoopAt.toISOString() },
        });
      await sendHeartbeat();
      heartbeatTimer = setInterval(() => {
        void sendHeartbeat().catch((error) => {
          writeServiceLog('warn', 'worker', 'heartbeat_failed', {
            instanceId: workerId,
            error: serializeSafeError(error, redactionSecrets),
          });
        });
      }, 15_000);
      heartbeatTimer.unref();
      writeServiceLog('info', 'worker', 'started', { instanceId: workerId });
      while (!stopping) {
        lastLoopAt = new Date();
        await recoverStaleWork();
        const worked = (await processOutbox()) || (await processJob());
        if (!worked) await sleep(env.WORKER_POLL_INTERVAL_MS);
      }
    } catch (error) {
      writeServiceLog('error', 'worker', 'startup_failed', {
        instanceId: workerId,
        error: serializeSafeError(error, redactionSecrets),
      });
      await observability
        .captureIncident({
          category: 'worker_error',
          serviceType: 'worker',
          error,
          route: 'startup',
          severity: 'critical',
        })
        .catch(() => undefined);
      throw error;
    } finally {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      await closeHealthServer();
      await pool.end();
      running = false;
      disposed = true;
    }
  }

  function run(): Promise<void> {
    if (running || disposed || stopping) {
      throw new Error('Frame worker instances can only be run once');
    }
    running = true;
    runCompletion = execute();
    return runCompletion;
  }

  async function stop(signal = 'manual'): Promise<void> {
    if (stopping) return;
    stopping = true;
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    writeServiceLog('info', 'worker', 'stopping', { instanceId: workerId, signal });
    if (running) {
      await observability
        .heartbeat({
          serviceType: 'worker',
          instanceId: workerId,
          version: env.APP_VERSION,
          status: 'stopping',
          startedAt: workerStartedAt,
          metadata: { signal },
        })
        .catch(() => undefined);
      await closeHealthServer();
    }
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    if (running) {
      await stop('dispose');
      await runCompletion;
      return;
    }
    stopping = true;
    await pool.end();
    disposed = true;
  }

  return {
    id: workerId,
    run,
    stop,
    dispose,
    getStatus: () => ({
      id: workerId,
      state: disposed ? 'stopped' : stopping ? 'stopping' : running ? 'running' : 'idle',
      lastLoopAt,
      extensions: system.extensions.map((extension) => extension.manifest.id),
      jobKinds: jobHandlers.listKinds(),
      eventTopics: subscribers.listTopics(),
    }),
  };
}

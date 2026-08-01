import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { jobRuns } from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'dead' | 'cancelled';
type JobRow = typeof jobRuns.$inferSelect;
const publicJobColumns = {
  id: jobRuns.id,
  queue: jobRuns.queue,
  kind: jobRuns.kind,
  status: jobRuns.status,
  priority: jobRuns.priority,
  dedupeKey: jobRuns.dedupeKey,
  relatedEntityType: jobRuns.relatedEntityType,
  relatedEntityId: jobRuns.relatedEntityId,
  attempts: jobRuns.attempts,
  maxAttempts: jobRuns.maxAttempts,
  availableAt: jobRuns.availableAt,
  lockedAt: jobRuns.lockedAt,
  lockedBy: jobRuns.lockedBy,
  lastError: jobRuns.lastError,
  startedAt: jobRuns.startedAt,
  finishedAt: jobRuns.finishedAt,
  createdBy: jobRuns.createdBy,
  createdAt: jobRuns.createdAt,
  updatedAt: jobRuns.updatedAt,
};

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : '后台任务执行失败').slice(0, 1000);
}

export function computeBackoffMs(attempts: number): number {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}

export class JobService {
  constructor(private readonly db: Database) {}

  async enqueue(input: {
    kind: string;
    payload?: Record<string, unknown>;
    queue?: string;
    priority?: number;
    maxAttempts?: number;
    availableAt?: Date;
    dedupeKey?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    createdBy?: string;
  }): Promise<JobRow> {
    const [created] = await this.db
      .insert(jobRuns)
      .values({
        kind: input.kind,
        payload: input.payload ?? {},
        queue: input.queue ?? 'default',
        priority: input.priority ?? 100,
        maxAttempts: input.maxAttempts ?? 5,
        availableAt: input.availableAt ?? new Date(),
        dedupeKey: input.dedupeKey,
        relatedEntityType: input.relatedEntityType,
        relatedEntityId: input.relatedEntityId,
        createdBy: input.createdBy,
      })
      .onConflictDoNothing({ target: jobRuns.dedupeKey })
      .returning();
    if (created) return created;
    if (!input.dedupeKey) throw new Error('Failed to enqueue job');
    const [existing] = await this.db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.dedupeKey, input.dedupeKey))
      .limit(1);
    if (!existing) throw new Error('Failed to load deduplicated job');
    return existing;
  }

  async list(input: { limit: number; offset: number; status?: JobStatus; search?: string }) {
    const filters = [];
    if (input.status) filters.push(eq(jobRuns.status, input.status));
    if (input.search) {
      const pattern = `%${input.search}%`;
      filters.push(
        or(
          ilike(jobRuns.kind, pattern),
          ilike(jobRuns.queue, pattern),
          ilike(jobRuns.dedupeKey, pattern),
          ilike(jobRuns.relatedEntityId, pattern),
        )!,
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const [items, totalResult] = await Promise.all([
      this.db
        .select(publicJobColumns)
        .from(jobRuns)
        .where(where)
        .orderBy(desc(jobRuns.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ count: count() }).from(jobRuns).where(where),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }

  async summary() {
    const rows = await this.db
      .select({ status: jobRuns.status, count: count() })
      .from(jobRuns)
      .groupBy(jobRuns.status);
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }

  async claimNext(workerId: string): Promise<JobRow | null> {
    const result = await this.db.execute<JobRow>(sql`
      WITH candidate AS (
        SELECT id FROM job_runs
        WHERE status = 'pending' AND available_at <= now()
        ORDER BY priority ASC, available_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE job_runs job
      SET status = 'running', attempts = job.attempts + 1, locked_at = now(),
          locked_by = ${workerId}, started_at = COALESCE(job.started_at, now()), updated_at = now()
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.*
    `);
    return result.rows[0] ?? null;
  }

  async markSucceeded(jobId: string, result: Record<string, unknown>) {
    await this.db
      .update(jobRuns)
      .set({
        status: 'succeeded',
        result,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(jobRuns.id, jobId), eq(jobRuns.status, 'running')));
  }

  async markFailed(job: JobRow, error: unknown): Promise<JobStatus> {
    const exhausted = job.attempts >= job.maxAttempts;
    const status: JobStatus = exhausted ? 'dead' : 'pending';
    await this.db
      .update(jobRuns)
      .set({
        status,
        lastError: safeError(error),
        availableAt: exhausted
          ? job.availableAt
          : new Date(Date.now() + computeBackoffMs(job.attempts)),
        lockedAt: null,
        lockedBy: null,
        finishedAt: exhausted ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(jobRuns.id, job.id));
    return status;
  }

  async recoverStale(timeoutMs: number, workerId: string): Promise<number> {
    const staleBefore = new Date(Date.now() - timeoutMs);
    const result = await this.db.execute<{ id: string }>(sql`
      UPDATE job_runs
      SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
          locked_at = NULL, locked_by = NULL, last_error = ${`任务锁超时，由 ${workerId} 恢复`},
          available_at = now(), updated_at = now()
      WHERE status = 'running' AND locked_at < ${staleBefore}
      RETURNING id
    `);
    return result.rows.length;
  }

  async retry(jobId: string, actorId: string) {
    const [job] = await this.db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);
    if (!job) throw httpError(404, '后台任务不存在', 'NotFoundError');
    if (!['dead', 'cancelled'].includes(job.status)) {
      throw httpError(409, '只有死亡或已取消任务可以重新入队', 'ConflictError');
    }
    await this.db
      .update(jobRuns)
      .set({
        status: 'pending',
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        result: null,
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(jobRuns.id, jobId));
    await recordAuditEvent(this.db, {
      action: 'job.retried',
      resourceType: 'job_run',
      resourceId: jobId,
      actorId,
      metadata: { kind: job.kind },
    });
  }

  async cancel(jobId: string, actorId: string) {
    const [job] = await this.db.select().from(jobRuns).where(eq(jobRuns.id, jobId)).limit(1);
    if (!job) throw httpError(404, '后台任务不存在', 'NotFoundError');
    if (job.status !== 'pending') throw httpError(409, '只有等待中的任务可以取消', 'ConflictError');
    await this.db
      .update(jobRuns)
      .set({ status: 'cancelled', finishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(jobRuns.id, jobId), eq(jobRuns.status, 'pending')));
    await recordAuditEvent(this.db, {
      action: 'job.cancelled',
      resourceType: 'job_run',
      resourceId: jobId,
      actorId,
      metadata: { kind: job.kind },
    });
  }
}

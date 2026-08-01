import { count, desc, eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { outboxEvents } from '../../db/schema.js';
import { computeBackoffMs } from './service.js';

type OutboxRow = typeof outboxEvents.$inferSelect;
const publicOutboxColumns = {
  id: outboxEvents.id,
  topic: outboxEvents.topic,
  status: outboxEvents.status,
  aggregateType: outboxEvents.aggregateType,
  aggregateId: outboxEvents.aggregateId,
  dedupeKey: outboxEvents.dedupeKey,
  attempts: outboxEvents.attempts,
  maxAttempts: outboxEvents.maxAttempts,
  availableAt: outboxEvents.availableAt,
  lockedAt: outboxEvents.lockedAt,
  lockedBy: outboxEvents.lockedBy,
  lastError: outboxEvents.lastError,
  publishedAt: outboxEvents.publishedAt,
  createdAt: outboxEvents.createdAt,
  updatedAt: outboxEvents.updatedAt,
};

export class OutboxService {
  constructor(private readonly db: Database) {}

  async publish(input: {
    topic: string;
    payload?: Record<string, unknown>;
    aggregateType?: string;
    aggregateId?: string;
    dedupeKey?: string;
    availableAt?: Date;
  }): Promise<OutboxRow> {
    const [created] = await this.db
      .insert(outboxEvents)
      .values({
        topic: input.topic,
        payload: input.payload ?? {},
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        dedupeKey: input.dedupeKey,
        availableAt: input.availableAt ?? new Date(),
      })
      .onConflictDoNothing({ target: outboxEvents.dedupeKey })
      .returning();
    if (created) return created;
    if (!input.dedupeKey) throw new Error('Failed to publish outbox event');
    const [existing] = await this.db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.dedupeKey, input.dedupeKey))
      .limit(1);
    if (!existing) throw new Error('Failed to load deduplicated outbox event');
    return existing;
  }

  async claimNext(workerId: string): Promise<OutboxRow | null> {
    const result = await this.db.execute<OutboxRow>(sql`
      WITH candidate AS (
        SELECT id FROM outbox_events
        WHERE status = 'pending' AND available_at <= now()
        ORDER BY available_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE outbox_events event
      SET status = 'processing', attempts = event.attempts + 1,
          locked_at = now(), locked_by = ${workerId}, updated_at = now()
      FROM candidate
      WHERE event.id = candidate.id
      RETURNING event.*
    `);
    return result.rows[0] ?? null;
  }

  async markPublished(eventId: string) {
    await this.db
      .update(outboxEvents)
      .set({
        status: 'published',
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(outboxEvents.id, eventId));
  }

  async markFailed(event: OutboxRow, error: unknown) {
    const exhausted = event.attempts >= event.maxAttempts;
    await this.db
      .update(outboxEvents)
      .set({
        status: exhausted ? 'dead' : 'pending',
        availableAt: exhausted
          ? event.availableAt
          : new Date(Date.now() + computeBackoffMs(event.attempts)),
        lockedAt: null,
        lockedBy: null,
        lastError: (error instanceof Error ? error.message : 'Outbox dispatch failed').slice(
          0,
          1000,
        ),
        updatedAt: new Date(),
      })
      .where(eq(outboxEvents.id, event.id));
  }

  async recoverStale(timeoutMs: number): Promise<number> {
    const result = await this.db.execute<{ id: string }>(sql`
      UPDATE outbox_events
      SET status = CASE WHEN attempts >= max_attempts THEN 'dead' ELSE 'pending' END,
          locked_at = NULL, locked_by = NULL, available_at = now(),
          last_error = 'Outbox processing lock expired', updated_at = now()
      WHERE status = 'processing' AND locked_at < ${new Date(Date.now() - timeoutMs)}
      RETURNING id
    `);
    return result.rows.length;
  }

  async list(input: { limit: number; offset: number }) {
    const [items, totalResult] = await Promise.all([
      this.db
        .select(publicOutboxColumns)
        .from(outboxEvents)
        .orderBy(desc(outboxEvents.createdAt))
        .limit(input.limit)
        .offset(input.offset),
      this.db.select({ count: count() }).from(outboxEvents),
    ]);
    return { items, total: Number(totalResult[0]?.count ?? 0) };
  }
}

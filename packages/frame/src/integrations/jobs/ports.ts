import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

import type { JobsPorts } from '@lingcootech/frame-jobs';
import { jobRuns, outboxEvents } from '@lingcootech/frame-database/schema';
import { createLegacyAuditPort } from '../audit/ports.js';

export function createLegacyJobsPorts(app: FastifyInstance): JobsPorts {
  return createLegacyJobsPortsForDatabase(app.db, createLegacyAuditPort(app.db));
}

export function createLegacyJobsPortsForDatabase(
  database: FastifyInstance['db'],
  audit: JobsPorts['audit'] = { async record() {} },
): JobsPorts {
  return {
    audit,
    commands: {
      async enqueue(input, transaction) {
        const executor = transaction ?? database;
        const [created] = await executor
          .insert(jobRuns)
          .values({ ...input, payload: input.payload ?? {} })
          .onConflictDoNothing({ target: jobRuns.dedupeKey })
          .returning({ id: jobRuns.id });
        if (created) return created;
        if (!input.dedupeKey) throw new Error('Failed to enqueue job');
        const [existing] = await executor
          .select({ id: jobRuns.id })
          .from(jobRuns)
          .where(eq(jobRuns.dedupeKey, input.dedupeKey))
          .limit(1);
        if (!existing) throw new Error('Failed to load deduplicated job');
        return existing;
      },
      async publish(input, transaction) {
        const executor = transaction ?? database;
        await executor
          .insert(outboxEvents)
          .values({ ...input, payload: input.payload ?? {} })
          .onConflictDoNothing({ target: outboxEvents.dedupeKey });
      },
    },
  };
}

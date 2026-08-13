import { z } from 'zod';

/** Public REST query contract for the Jobs administration API. */
export const jobListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['pending', 'running', 'succeeded', 'dead', 'cancelled']).optional(),
  search: z.string().trim().max(120).optional(),
});

export const jobParamsSchema = z.object({ jobId: z.uuid() });

export const outboxListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

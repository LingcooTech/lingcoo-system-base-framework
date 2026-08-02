import { z } from 'zod';

export const datasetParamsSchema = z.object({
  datasetCode: z.string().trim().min(3).max(120),
});

export const importDocumentSchema = z.object({ document: z.unknown() });

export const exchangeRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

import { z } from 'zod';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(120).optional(),
  action: z.string().trim().max(120).optional(),
  resourceType: z.string().trim().max(120).optional(),
  actorId: z.uuid().optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
});

export const auditParamsSchema = z.object({ auditId: z.uuid() });

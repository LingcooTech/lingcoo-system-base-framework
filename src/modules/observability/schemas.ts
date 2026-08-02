import { z } from 'zod';

export const incidentQuerySchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
});

export const incidentParamsSchema = z.object({ incidentId: z.uuid() });

export const updateIncidentSchema = z.object({ status: z.enum(['open', 'resolved']) });

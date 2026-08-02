import { z } from 'zod';

export const settingParamsSchema = z.object({
  settingKey: z.string().trim().min(3).max(120),
});

export const updateSettingSchema = z.object({
  value: z.unknown(),
  reason: z.string().trim().max(500).optional(),
});

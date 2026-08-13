import { z } from 'zod';

const providerCode = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value), {
    message: 'Provider 代码格式无效',
  });
const dynamicValues = z.record(z.string().min(1).max(120), z.unknown());

export const createConnectionSchema = z.object({
  providerCode,
  name: z.string().trim().min(1).max(120),
  config: dynamicValues.default({}),
  credentials: dynamicValues.default({}),
});

export const updateConnectionSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    config: dynamicValues.optional(),
    credentials: z.record(z.string().min(1).max(120), z.union([z.unknown(), z.null()])).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

export const connectionParamsSchema = z.object({ connectionId: z.uuid() });

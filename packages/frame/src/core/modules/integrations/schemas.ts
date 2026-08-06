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

export const smtpTestEmailSchema = z.object({
  to: z.email().max(254),
  subject: z.string().trim().min(1).max(200),
  text: z.string().trim().min(1).max(5000),
});

const objectKey = z.string().trim().min(1).max(1024);

export const qiniuObjectListSchema = z.object({
  prefix: z.string().trim().max(512).optional(),
  marker: z.string().trim().max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export const qiniuObjectKeySchema = z.object({ key: objectKey });

export const qiniuSignedAccessSchema = z.object({
  key: objectKey,
  expiresInSeconds: z.number().int().min(60).max(86_400).optional(),
});

export const openRouterChatSchema = z.object({
  model: z.string().trim().min(1).max(200).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().trim().min(1).max(20_000),
      }),
    )
    .min(1)
    .max(40),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8192).optional(),
});

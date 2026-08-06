import { z } from 'zod';

export const assetListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(['pending', 'active', 'archived', 'deleting', 'deleted', 'failed']).optional(),
  mediaKind: z.enum(['image', 'video', 'audio', 'document', 'archive', 'other']).optional(),
  search: z.string().trim().max(120).optional(),
});

export const createUploadIntentSchema = z.object({
  connectionId: z.uuid().optional(),
  filename: z.string().trim().min(1).max(255),
  mimeType: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .transform((value) => value.toLowerCase())
    .refine((value) => /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/.test(value), {
      message: 'MIME 类型格式无效',
    }),
  byteSize: z
    .number()
    .int()
    .min(1)
    .max(100 * 1024 * 1024),
  visibility: z.enum(['public', 'private']).default('public'),
  directory: z.string().trim().max(160).optional(),
});

export const assetParamsSchema = z.object({ assetId: z.uuid() });
export const assetReferenceParamsSchema = z.object({
  assetId: z.uuid(),
  referenceId: z.uuid(),
});

export const updateAssetSchema = z
  .object({
    displayName: z.string().trim().min(1).max(255).optional(),
    metadata: z.record(z.string().min(1).max(80), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

const referencePart = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/, '引用标识格式无效');

export const createAssetReferenceSchema = z.object({
  ownerType: referencePart,
  ownerId: referencePart,
  field: referencePart.default('default'),
});

export const assetDeleteJobPayloadSchema = z.object({ assetId: z.uuid() });

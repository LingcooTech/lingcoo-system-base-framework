import { z } from 'zod';

export const metadataCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .transform((value) => value.toLowerCase())
  .refine((value) => /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value), {
    message: '代码格式无效',
  });

const statusSchema = z.enum(['active', 'inactive']);

export const createDictionarySchema = z.object({
  code: metadataCodeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']).default('string'),
});

export const updateDictionarySchema = createDictionarySchema
  .omit({ code: true })
  .partial()
  .extend({ status: statusSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

export const createDictionaryItemSchema = z.object({
  code: metadataCodeSchema,
  label: z.string().trim().min(1).max(160),
  value: z.unknown(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.number().int().min(-100000).max(100000).default(100),
  status: statusSchema.default('active'),
});

export const updateDictionaryItemSchema = createDictionaryItemSchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

export const createTaxonomySchema = z.object({
  code: metadataCodeSchema,
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['tag', 'category']),
  description: z.string().trim().max(500).optional(),
  hierarchical: z.boolean().default(false),
});

export const updateTaxonomySchema = createTaxonomySchema
  .omit({ code: true })
  .partial()
  .extend({ status: statusSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

export const createTermSchema = z.object({
  code: metadataCodeSchema,
  name: z.string().trim().min(1).max(160),
  parentId: z.uuid().nullable().optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  sortOrder: z.number().int().min(-100000).max(100000).default(100),
  status: statusSchema.default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const updateTermSchema = createTermSchema
  .omit({ code: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, '至少提供一个修改项');

export const codeParamsSchema = z.object({ code: metadataCodeSchema });
export const itemParamsSchema = z.object({ code: metadataCodeSchema, itemId: z.uuid() });
export const termParamsSchema = z.object({ code: metadataCodeSchema, termId: z.uuid() });

export const assignmentQuerySchema = z.object({
  resourceType: metadataCodeSchema,
  resourceId: z.string().trim().min(1).max(200),
});

export const createAssignmentSchema = assignmentQuerySchema.extend({
  taxonomyCode: metadataCodeSchema,
  termCode: metadataCodeSchema,
});

export const assignmentParamsSchema = z.object({ assignmentId: z.uuid() });

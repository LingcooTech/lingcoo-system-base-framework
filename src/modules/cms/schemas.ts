import { z } from 'zod';

const nullableText = (max: number) => z.string().trim().max(max).nullable();
const nullableAsset = z.uuid().nullable();

export const cmsContentInputSchema = z.object({
  type: z.enum(['article', 'page']),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .transform((value) => value.toLowerCase())
    .refine(
      (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      'Slug 只能包含小写字母、数字和连字符',
    ),
  title: z.string().trim().min(1).max(200),
  excerpt: nullableText(500),
  body: z.string().max(200000),
  coverAssetId: nullableAsset,
  socialImageAssetId: nullableAsset,
  pinned: z.boolean(),
  seoTitle: nullableText(120),
  seoDescription: nullableText(300),
  termIds: z.array(z.uuid()).max(100).default([]),
  changeReason: z.string().trim().max(300).optional(),
});

export const cmsListSchema = z.object({
  type: z.enum(['article', 'page']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const cmsParamsSchema = z.object({ contentId: z.uuid() });
export const publicCmsParamsSchema = z.object({
  type: z.enum(['articles', 'pages']),
  slug: z.string().trim().min(1).max(160),
});
export const cmsStatusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) });

export type CmsContentInput = z.infer<typeof cmsContentInputSchema>;

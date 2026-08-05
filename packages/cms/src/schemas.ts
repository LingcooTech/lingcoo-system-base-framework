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
export const cmsRedirectParamsSchema = z.object({ redirectId: z.uuid() });
const internalPath = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((value) => value.startsWith('/') && !value.startsWith('//'), '必须是站内绝对路径');
export const cmsRedirectInputSchema = z
  .object({
    sourcePath: internalPath.refine((value) => !value.includes('?') && !value.includes('#'), {
      message: '来源路径不能包含查询参数或锚点',
    }),
    targetPath: internalPath,
    statusCode: z.union([z.literal(301), z.literal(302)]).default(301),
    enabled: z.boolean().default(true),
  })
  .refine((value) => value.sourcePath !== value.targetPath, '来源与目标路径不能相同');
export const cmsScheduleSchema = z.object({
  publishAt: z.iso.datetime({ offset: true }).nullable(),
});
export const cmsScheduledJobSchema = z.object({
  contentId: z.uuid(),
  publishAt: z.iso.datetime({ offset: true }),
  actorId: z.uuid(),
});
export const publicCmsParamsSchema = z.object({
  type: z.enum(['articles', 'pages']),
  slug: z.string().trim().min(1).max(160),
});
export const publicCmsListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .transform(({ limit, page, pageSize }) => ({ page, pageSize: pageSize ?? limit ?? 12 }));
export const cmsStatusSchema = z.object({ status: z.enum(['draft', 'published', 'archived']) });

export type CmsContentInput = z.infer<typeof cmsContentInputSchema>;
export type CmsRedirectInput = z.infer<typeof cmsRedirectInputSchema>;

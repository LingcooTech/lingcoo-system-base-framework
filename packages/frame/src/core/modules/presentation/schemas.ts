import { z } from 'zod';

const optionalText = (max: number) => z.string().trim().max(max).nullable();
const optionalEmail = z
  .union([z.literal(''), z.email().max(254), z.null()])
  .transform((value) => value || null);
const optionalUrl = z
  .union([z.literal(''), z.url().max(500), z.null()])
  .transform((value) => value || null);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, '颜色必须使用六位十六进制格式');
const assetId = z.uuid().nullable();
const link = z.object({
  label: z.string().trim().min(1).max(80),
  href: z.string().trim().min(1).max(500),
});

export const presentationInputSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  shortName: optionalText(40),
  slogan: optionalText(180),
  fullLogoAssetId: assetId,
  squareLogoAssetId: assetId,
  darkLogoAssetId: assetId,
  faviconAssetId: assetId,
  socialImageAssetId: assetId,
  primaryColor: color,
  secondaryColor: color,
  accentColor: color,
  contactEmail: optionalEmail,
  contactPhone: optionalText(40),
  contactAddress: optionalText(240),
  publicUrl: optionalUrl,
  seoTitle: optionalText(120),
  seoDescription: optionalText(300),
  headerNavigation: z.array(link).max(20),
  footerLinks: z.array(link).max(30),
  footerCopyright: optionalText(240),
  filingInfo: optionalText(120),
  changeReason: z.string().trim().max(300).optional(),
});

export type PresentationInput = z.infer<typeof presentationInputSchema>;

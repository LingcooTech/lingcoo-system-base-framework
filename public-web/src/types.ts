export interface PublicAsset {
  publicUrl: string | null;
  displayName?: string;
  mimeType?: string;
}

export interface CmsContent {
  id: string;
  type: 'article' | 'page';
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverAssetId: string | null;
  socialImageAssetId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  author: { displayName: string } | null;
  terms: { id: string; name: string; color: string | null }[];
  assets: Record<string, PublicAsset>;
}

export interface ArticleListResponse {
  items: CmsContent[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

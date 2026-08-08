export interface CmsPublicAsset {
  publicUrl: string | null;
  displayName?: string;
  mimeType?: string;
}

export interface CmsPublicContent {
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
  assets: Record<string, CmsPublicAsset>;
}

export interface CmsArticleListResponse {
  items: CmsPublicContent[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export class CmsWebRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'CmsWebRequestError';
  }
}

export interface CmsWebClient {
  getPreview(contentId: string, signal?: AbortSignal): Promise<CmsPublicContent>;
  getArticle(slug: string, signal?: AbortSignal): Promise<CmsPublicContent>;
  getPage(slug: string, signal?: AbortSignal): Promise<CmsPublicContent>;
  listArticles(
    page: number,
    pageSize: number,
    signal?: AbortSignal,
  ): Promise<CmsArticleListResponse>;
}

export type CmsWebFetch = (path: string, init?: RequestInit) => Promise<Response>;

export function createCmsWebClient(request: CmsWebFetch): CmsWebClient {
  async function requestJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await request(path, { signal });
    if (!response.ok) {
      throw new CmsWebRequestError(
        response.status === 404 ? 'CMS content not found' : 'CMS request failed',
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  async function getContent(path: string, signal?: AbortSignal) {
    return (await requestJson<{ content: CmsPublicContent }>(path, signal)).content;
  }

  return {
    getPreview(contentId, signal) {
      return getContent(`/api/cms/entries/${encodeURIComponent(contentId)}/preview`, signal);
    },
    getArticle(slug, signal) {
      return getContent(`/api/public/cms/articles/${encodeURIComponent(slug)}`, signal);
    },
    getPage(slug, signal) {
      return getContent(`/api/public/cms/pages/${encodeURIComponent(slug)}`, signal);
    },
    listArticles(page, pageSize, signal) {
      return requestJson(`/api/public/cms/articles?page=${page}&pageSize=${pageSize}`, signal);
    },
  };
}

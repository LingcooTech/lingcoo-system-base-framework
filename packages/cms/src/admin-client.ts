export interface CmsAdminAsset {
  id: string;
  displayName: string;
  publicUrl: string | null;
  mimeType: string;
  status: string;
  visibility: string;
  mediaKind: string;
}

export interface CmsPresentationAsset {
  id: string;
  displayName: string;
  publicUrl: string | null;
  mimeType: string;
}

export interface CmsPresentationProfile {
  displayName: string;
  publicUrl: string | null;
}

export interface CmsTaxonomy {
  code: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface CmsTaxonomyTerm {
  id: string;
  name: string;
  color: string | null;
  status: 'active' | 'inactive';
}

export interface CmsTerm {
  id: string;
  code: string;
  name: string;
  color: string | null;
  taxonomyCode: string;
  taxonomyName: string;
  taxonomyKind: 'tag' | 'category';
}

export interface CmsContent {
  id: string;
  type: 'article' | 'page';
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  bodyFormat: 'markdown';
  coverAssetId: string | null;
  socialImageAssetId: string | null;
  status: 'draft' | 'published' | 'archived';
  pinned: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  currentVersion: number;
  updatedAt: string;
  author: { id: string; displayName: string } | null;
  terms: CmsTerm[];
  assets: Record<string, CmsPresentationAsset>;
}

export interface CmsContentInput {
  type: CmsContent['type'];
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  coverAssetId: string | null;
  socialImageAssetId: string | null;
  pinned: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  termIds: string[];
  changeReason?: string;
}

export interface CmsVersion {
  id: string;
  version: number;
  changeReason: string | null;
  createdAt: string;
  actor: { id: string; displayName: string } | null;
}

export interface CmsRedirect {
  id: string;
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 302;
  enabled: boolean;
  updatedAt: string;
}

export interface CmsRedirectInput {
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 302;
  enabled: boolean;
}

export interface CmsContentFilters {
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CmsAdminClient {
  listContents(filters?: CmsContentFilters): Promise<{ items: CmsContent[]; total: number }>;
  getContent(contentId: string): Promise<CmsContent>;
  createContent(input: CmsContentInput): Promise<CmsContent>;
  updateContent(contentId: string, input: CmsContentInput): Promise<CmsContent>;
  updateStatus(contentId: string, status: CmsContent['status']): Promise<CmsContent>;
  scheduleContent(contentId: string, publishAt: string | null): Promise<CmsContent>;
  listVersions(contentId: string): Promise<CmsVersion[]>;
  listRedirects(): Promise<CmsRedirect[]>;
  createRedirect(input: CmsRedirectInput): Promise<CmsRedirect>;
  updateRedirect(redirectId: string, input: CmsRedirectInput): Promise<CmsRedirect>;
  deleteRedirect(redirectId: string): Promise<void>;
  listAssets(): Promise<{ items: CmsAdminAsset[]; total?: number } | CmsAdminAsset[]>;
  getPresentation(): Promise<CmsPresentationProfile>;
  listTaxonomies(): Promise<CmsTaxonomy[]>;
  listTaxonomyTerms(code: string): Promise<CmsTaxonomyTerm[]>;
}

export type CmsAdminRequest = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createCmsAdminClient(request: CmsAdminRequest): CmsAdminClient {
  return {
    async listContents(filters = {}) {
      const params = new URLSearchParams();
      if (filters.type) params.set('type', filters.type);
      if (filters.status) params.set('status', filters.status);
      if (filters.search) params.set('search', filters.search);
      const pageSize = filters.pageSize ?? 20;
      params.set('limit', String(pageSize));
      params.set('offset', String(((filters.page ?? 1) - 1) * pageSize));
      return request(`/api/cms/entries?${params}`);
    },
    async getContent(contentId) {
      return (await request<{ content: CmsContent }>(`/api/cms/entries/${contentId}`)).content;
    },
    async createContent(input) {
      return (
        await request<{ content: CmsContent }>('/api/cms/entries', {
          method: 'POST',
          body: JSON.stringify(input),
        })
      ).content;
    },
    async updateContent(contentId, input) {
      return (
        await request<{ content: CmsContent }>(`/api/cms/entries/${contentId}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        })
      ).content;
    },
    async updateStatus(contentId, status) {
      return (
        await request<{ content: CmsContent }>(`/api/cms/entries/${contentId}/status`, {
          method: 'POST',
          body: JSON.stringify({ status }),
        })
      ).content;
    },
    async scheduleContent(contentId, publishAt) {
      return (
        await request<{ content: CmsContent }>(`/api/cms/entries/${contentId}/schedule`, {
          method: 'POST',
          body: JSON.stringify({ publishAt }),
        })
      ).content;
    },
    async listVersions(contentId) {
      return (await request<{ items: CmsVersion[] }>(`/api/cms/entries/${contentId}/versions`))
        .items;
    },
    async listRedirects() {
      return (await request<{ items: CmsRedirect[] }>('/api/cms/redirects')).items;
    },
    async createRedirect(input) {
      return (
        await request<{ redirect: CmsRedirect }>('/api/cms/redirects', {
          method: 'POST',
          body: JSON.stringify(input),
        })
      ).redirect;
    },
    async updateRedirect(redirectId, input) {
      return (
        await request<{ redirect: CmsRedirect }>(`/api/cms/redirects/${redirectId}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        })
      ).redirect;
    },
    async deleteRedirect(redirectId) {
      await request(`/api/cms/redirects/${redirectId}`, { method: 'DELETE' });
    },
    async listAssets() {
      return request('/api/assets?limit=100');
    },
    async getPresentation() {
      return (await request<{ presentation: CmsPresentationProfile }>('/api/presentation'))
        .presentation;
    },
    async listTaxonomies() {
      return (await request<{ items: CmsTaxonomy[] }>('/api/metadata/taxonomies')).items;
    },
    async listTaxonomyTerms(code) {
      return (
        await request<{ items: CmsTaxonomyTerm[] }>(
          `/api/metadata/taxonomies/${encodeURIComponent(code)}/terms`,
        )
      ).items;
    },
  };
}

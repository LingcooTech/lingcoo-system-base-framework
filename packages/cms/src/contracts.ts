import { FRAME_VERSION, type ExtensionManifest } from '@lingcoo/frame-extension-sdk';

export const CMS_EXTENSION_ID = 'frame-cms';
export const CMS_EXTENSION_VERSION = FRAME_VERSION;

export const cmsManifest = {
  id: CMS_EXTENSION_ID,
  version: CMS_EXTENSION_VERSION,
  apiVersion: '1',
  frame: `^${FRAME_VERSION}`,
  dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
  permissions: ['cms.read', 'cms.write', 'cms.publish'],
  server: {
    routes: [
      { method: 'GET', path: '/api/public/cms/articles' },
      { method: 'GET', path: '/api/public/cms/:type/:slug' },
      { method: 'GET', path: '/api/cms/redirects' },
      { method: 'POST', path: '/api/cms/redirects' },
      { method: 'PATCH', path: '/api/cms/redirects/:redirectId' },
      { method: 'DELETE', path: '/api/cms/redirects/:redirectId' },
      { method: 'GET', path: '/api/cms/entries' },
      { method: 'POST', path: '/api/cms/entries' },
      { method: 'GET', path: '/api/cms/entries/:contentId' },
      { method: 'GET', path: '/api/cms/entries/:contentId/preview' },
      { method: 'GET', path: '/api/cms/entries/:contentId/versions' },
      { method: 'PATCH', path: '/api/cms/entries/:contentId' },
      { method: 'POST', path: '/api/cms/entries/:contentId/schedule' },
      { method: 'POST', path: '/api/cms/entries/:contentId/status' },
    ],
  },
  worker: { jobs: ['cms.content.publish-scheduled'] },
  migrations: {
    sourceId: CMS_EXTENSION_ID,
    migrations: [
      {
        id: '0009_cms_lite.sql',
        legacyAliases: ['0009_cms_lite.sql', 'frame/0009_cms_lite.sql'],
      },
      {
        id: '0011_cms_workflow.sql',
        legacyAliases: ['0011_cms_workflow.sql', 'frame/0011_cms_workflow.sql'],
      },
    ],
  },
  admin: {
    routes: [
      {
        id: 'frame-cms.content',
        path: '/cms/*',
        title: '轻量内容中心',
        description: '管理通用页面与文章的草稿、发布和版本。',
        permission: 'cms.read',
      },
    ],
    navigation: [
      {
        id: 'frame-cms.content',
        routeId: 'frame-cms.content',
        href: '/cms',
        label: '内容管理',
        group: '站点',
        order: 120,
      },
    ],
  },
  web: {
    routes: [
      { id: 'frame-cms.preview-content', path: '/preview/content/:id' },
      { id: 'frame-cms.articles', path: '/articles' },
      { id: 'frame-cms.article', path: '/articles/:slug' },
      { id: 'frame-cms.page', path: '/pages/:slug' },
    ],
    seo: [{ id: 'frame-cms.articles', routeId: 'frame-cms.articles' }],
    sitemap: [{ id: 'frame-cms.index' }],
  },
} as const satisfies ExtensionManifest;

export interface CmsAuditEvent {
  action: string;
  resourceType: string;
  resourceId?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}

export interface CmsPublicAsset {
  id: string;
  displayName: string;
  publicUrl: string | null;
}

export interface CmsPublicRoute {
  path: string;
  updatedAt?: Date | null;
}

export interface CmsRedirectResolution {
  targetPath: string;
  statusCode: number;
}

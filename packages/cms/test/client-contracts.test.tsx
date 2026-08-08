import assert from 'node:assert/strict';
import test from 'node:test';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminAuthProvider } from '@lingcoo/frame-admin/auth';
import { AdminRouterProvider } from '@lingcoo/frame-admin/router';
import { ConfirmProvider } from '@lingcoo/frame-admin/shared';
import { ToastProvider } from '@lingcoo/frame-ui/toast';

import { CmsAdminPage, createCmsAdminClient, createCmsAdminExtension } from '../src/admin.js';
import { CmsWebRequestError, createCmsWebClient, createCmsWebExtension } from '../src/web.js';

Object.assign(globalThis, { React });

test('CMS Admin client owns endpoint mapping and the extension installs its default page', async () => {
  const requests: Array<{ path: string; init?: RequestInit }> = [];
  const client = createCmsAdminClient(async <T,>(path: string, init?: RequestInit) => {
    requests.push({ path, init });
    if (path.startsWith('/api/cms/entries?')) return { items: [], total: 0 } as T;
    return { content: { id: 'content-1' } } as T;
  });

  await client.listContents({ page: 2, pageSize: 20, search: 'Frame', type: 'article' });
  assert.equal(requests[0]?.path, '/api/cms/entries?type=article&search=Frame&limit=20&offset=20');

  const surface = createCmsAdminExtension({ client });
  assert.equal(surface.routes?.[0]?.id, 'frame-cms.content');
  assert.equal(typeof surface.routes?.[0]?.component, 'function');
  assert.equal(surface.navigation?.[0]?.id, 'frame-cms.content');
  assert.ok(surface.navigation?.[0]?.icon);
});

test('packaged CMS Admin page renders list and editor routes inside Frame providers', () => {
  const client = createCmsAdminClient(async () => {
    throw new Error('Effects do not run during server rendering');
  });
  const authClient = {
    async getCurrentAccount() {
      return null;
    },
    async login() {
      throw new Error('Not used');
    },
    async logout() {},
    async changePassword() {},
  };
  const renderRoute = (pathname: string) => {
    Object.assign(globalThis, {
      window: {
        location: { origin: 'https://frame.example.test', pathname, search: '' },
      },
    });
    return renderToStaticMarkup(
      <ToastProvider>
        <ConfirmProvider>
          <AdminAuthProvider client={authClient}>
            <AdminRouterProvider>
              <CmsAdminPage client={client} />
            </AdminRouterProvider>
          </AdminAuthProvider>
        </ConfirmProvider>
      </ToastProvider>,
    );
  };

  const list = renderRoute('/admin/cms');
  assert.match(list, /轻量内容中心/);
  assert.match(list, /页面与文章/);
  assert.match(list, /URL 重定向/);

  const editor = renderRoute('/admin/cms/new/article');
  assert.match(editor, /新建文章/);
  assert.match(editor, /SEO 预览/);
  assert.match(editor, /Markdown/);
});

test('CMS Web client maps public and preview routes and preserves not-found status', async () => {
  const paths: string[] = [];
  const client = createCmsWebClient(async (path) => {
    paths.push(path);
    if (path.includes('missing')) return new Response(null, { status: 404 });
    return Response.json({
      content: {
        id: 'content-1',
        type: 'article',
        slug: 'release',
        title: 'Release',
        excerpt: null,
        body: '',
        coverAssetId: null,
        socialImageAssetId: null,
        seoTitle: null,
        seoDescription: null,
        publishedAt: null,
        author: null,
        terms: [],
        assets: {},
      },
    });
  });

  await client.getPreview('draft/id');
  await client.getArticle('release notes');
  assert.deepEqual(paths.slice(0, 2), [
    '/api/cms/entries/draft%2Fid/preview',
    '/api/public/cms/articles/release%20notes',
  ]);
  await assert.rejects(
    () => client.getPage('missing'),
    (error: unknown) => error instanceof CmsWebRequestError && error.status === 404,
  );

  const surface = createCmsWebExtension({
    client,
    resolvePresentation: () => null,
  });
  assert.deepEqual(
    surface.routes?.map((route) => route.id),
    ['frame-cms.preview-content', 'frame-cms.articles', 'frame-cms.article', 'frame-cms.page'],
  );
  assert.ok(surface.routes?.every((route) => typeof route.component === 'function'));
});

import {
  defineWebExtension,
  type WebRouteComponent,
  type WebRouteContext,
} from '@lingcoo/frame-web';
import type { PublicPresentation } from '@lingcoo/frame-web/presentation';

import { ArticleCard } from './article-card.js';
import { ArticleList } from './article-list.js';
import { ContentDetail } from './content-detail.js';
import { ContentRenderer } from './content-renderer.js';
import { EmptyContent } from './empty-content.js';
import { createCmsWebClient, type CmsWebClient } from './web-client.js';
import { ArticleIndexPage, CmsContentPage } from './web-pages.js';

export function createCmsWebExtension<TContext>(options: {
  client: CmsWebClient;
  resolvePresentation(context: TContext): PublicPresentation | null;
  articlePageSize?: number;
  preview?: WebRouteComponent<TContext>;
  articleIndex?: WebRouteComponent<TContext>;
  article?: WebRouteComponent<TContext>;
  page?: WebRouteComponent<TContext>;
}) {
  const presentation = ({ context }: WebRouteContext<TContext>) =>
    options.resolvePresentation(context);
  const PreviewRoute: WebRouteComponent<TContext> = (route) => (
    <CmsContentPage
      client={options.client}
      contentId={route.params.id ?? ''}
      contentType="article"
      presentation={presentation(route)}
      preview
    />
  );
  const ArticleIndexRoute: WebRouteComponent<TContext> = (route) => {
    const requestedPage = Number(route.searchParams.get('page') || '1');
    const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    return (
      <ArticleIndexPage
        client={options.client}
        page={page}
        pageSize={options.articlePageSize}
        presentation={presentation(route)}
      />
    );
  };
  const ArticleRoute: WebRouteComponent<TContext> = (route) => (
    <CmsContentPage
      client={options.client}
      contentId={route.params.slug ?? ''}
      contentType="article"
      presentation={presentation(route)}
    />
  );
  const PageRoute: WebRouteComponent<TContext> = (route) => (
    <CmsContentPage
      client={options.client}
      contentId={route.params.slug ?? ''}
      contentType="page"
      presentation={presentation(route)}
    />
  );
  return defineWebExtension<TContext>({
    routes: [
      { id: 'frame-cms.preview-content', component: options.preview ?? PreviewRoute },
      { id: 'frame-cms.articles', component: options.articleIndex ?? ArticleIndexRoute },
      { id: 'frame-cms.article', component: options.article ?? ArticleRoute },
      { id: 'frame-cms.page', component: options.page ?? PageRoute },
    ],
    seo: [
      {
        id: 'frame-cms.articles',
        resolve({ searchParams }) {
          const page = Number(searchParams.get('page') || '1');
          return {
            title: '文章',
            canonicalPath: page > 1 ? `/articles?page=${page}` : '/articles',
          };
        },
      },
    ],
    sitemap: [
      {
        id: 'frame-cms.index',
        collect() {
          return [{ path: '/articles', changeFrequency: 'daily', priority: 0.8 }];
        },
      },
    ],
  });
}

export {
  ArticleCard,
  ArticleIndexPage,
  ArticleList,
  CmsContentPage,
  ContentDetail,
  ContentRenderer,
  createCmsWebClient,
  EmptyContent,
};
export type {
  CmsArticleListResponse,
  CmsPublicAsset,
  CmsPublicContent,
  CmsWebClient,
  CmsWebFetch,
} from './web-client.js';
export { CmsWebRequestError } from './web-client.js';

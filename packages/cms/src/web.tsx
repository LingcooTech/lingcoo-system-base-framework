import { defineWebExtension, type WebRouteComponent } from '@lingcoo/frame-web';

export function createCmsWebExtension<TContext>(options: {
  preview: WebRouteComponent<TContext>;
  articleIndex: WebRouteComponent<TContext>;
  article: WebRouteComponent<TContext>;
  page: WebRouteComponent<TContext>;
}) {
  return defineWebExtension<TContext>({
    routes: [
      { id: 'frame-cms.preview-content', component: options.preview },
      { id: 'frame-cms.articles', component: options.articleIndex },
      { id: 'frame-cms.article', component: options.article },
      { id: 'frame-cms.page', component: options.page },
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

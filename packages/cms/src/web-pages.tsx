import { Pagination } from '@lingcoo/frame-ui/pagination';
import { Skeleton } from '@lingcoo/frame-ui/skeleton';
import { PageHeader, Section } from '@lingcoo/frame-web/layout';
import type { PublicPresentation } from '@lingcoo/frame-web/presentation';
import { SeoHead } from '@lingcoo/frame-web/seo';
import { SiteShell } from '@lingcoo/frame-web/site';
import { PageLoading, SystemPage } from '@lingcoo/frame-web/system-states';
import { useEffect, useState } from 'react';

import { ArticleList } from './article-list.js';
import { ContentDetail } from './content-detail.js';
import {
  CmsWebRequestError,
  type CmsArticleListResponse,
  type CmsPublicContent,
  type CmsWebClient,
} from './web-client.js';

type RequestState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'not-found' }
  | { status: 'error' };

export function CmsContentPage({
  client,
  contentId,
  contentType,
  presentation,
  preview = false,
}: {
  client: CmsWebClient;
  contentId: string;
  contentType: 'article' | 'page';
  presentation: PublicPresentation | null;
  preview?: boolean;
}) {
  const [state, setState] = useState<RequestState<CmsPublicContent>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const request = preview
      ? client.getPreview(contentId, controller.signal)
      : contentType === 'article'
        ? client.getArticle(contentId, controller.signal)
        : client.getPage(contentId, controller.signal);
    request
      .then((content) => setState({ status: 'ready', data: content }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status:
            error instanceof CmsWebRequestError && error.status === 404 ? 'not-found' : 'error',
        });
      });
    return () => controller.abort();
  }, [client, contentId, contentType, preview]);

  if (state.status === 'loading')
    return <PageLoading label="正在加载内容" presentation={presentation} />;
  if (state.status === 'not-found') return <SystemPage kind="404" presentation={presentation} />;
  if (state.status === 'error') return <SystemPage kind="500" presentation={presentation} />;
  return (
    <SiteShell presentation={presentation}>
      <ContentDetail content={state.data} presentation={presentation} preview={preview} />
    </SiteShell>
  );
}

export function ArticleIndexPage({
  client,
  page,
  pageSize = 12,
  presentation,
}: {
  client: CmsWebClient;
  page: number;
  pageSize?: number;
  presentation: PublicPresentation | null;
}) {
  const [state, setState] = useState<RequestState<CmsArticleListResponse>>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    client
      .listArticles(page, pageSize, controller.signal)
      .then((result) => setState({ status: 'ready', data: result }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [client, page, pageSize]);

  if (state.status === 'error') return <SystemPage kind="500" presentation={presentation} />;
  if (state.status === 'not-found') return <SystemPage kind="404" presentation={presentation} />;
  return (
    <SiteShell presentation={presentation}>
      <SeoHead
        canonicalPath={page > 1 ? `/articles?page=${page}` : '/articles'}
        description="浏览由内容中心发布的文章。"
        presentation={presentation}
        title="文章"
      />
      <Section className="cms-public-index" containerSize="content">
        <PageHeader description="由轻量内容中心发布的公共文章。" eyebrow="Content" title="文章" />
        {state.status === 'loading' ? (
          <div aria-label="正在加载文章" className="cms-public-index-loading" role="status">
            <Skeleton shape="block" />
            <Skeleton shape="block" />
            <Skeleton shape="block" />
          </div>
        ) : (
          <>
            <ArticleList items={state.data.items} />
            <Pagination
              hrefForPage={(target) => (target === 1 ? '/articles' : `/articles?page=${target}`)}
              page={state.data.page}
              pageCount={state.data.pageCount}
            />
          </>
        )}
      </Section>
    </SiteShell>
  );
}

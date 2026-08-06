import { Pagination } from '@lingcoo/frame-ui/pagination';
import { Skeleton } from '@lingcoo/frame-ui/skeleton';
import { useEffect, useState } from 'react';

import type { ArticleListResponse, CmsContent } from '../../types';
import { PageHeader, Section } from '../site/Layout';
import { SeoHead } from '../site/SeoHead';
import { SiteShell, type PublicPresentation } from '../site/SiteShell';
import { PageLoading, SystemPage } from '../site/SystemStates';
import { ArticleList } from './ArticleList';
import { ContentDetail } from './ContentDetail';

type RequestState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'not-found' }
  | { status: 'error' };

async function requestJson<T>(endpoint: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(endpoint, { signal });
  if (response.status === 404) throw new Error('not-found');
  if (!response.ok) throw new Error('request-failed');
  return (await response.json()) as T;
}

export function CmsContentPage({
  endpoint,
  presentation,
  preview = false,
}: {
  endpoint: string;
  presentation: PublicPresentation | null;
  preview?: boolean;
}) {
  const [state, setState] = useState<RequestState<CmsContent>>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    requestJson<{ content: CmsContent }>(endpoint, controller.signal)
      .then((result) => setState({ status: 'ready', data: result.content }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: error instanceof Error && error.message === 'not-found' ? 'not-found' : 'error',
        });
      });
    return () => controller.abort();
  }, [endpoint]);

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
  page,
  presentation,
}: {
  page: number;
  presentation: PublicPresentation | null;
}) {
  const [state, setState] = useState<RequestState<ArticleListResponse>>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    requestJson<ArticleListResponse>(
      `/api/public/cms/articles?page=${page}&pageSize=12`,
      controller.signal,
    )
      .then((result) => setState({ status: 'ready', data: result }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' });
      });
    return () => controller.abort();
  }, [page]);

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

import { Button } from '@lingcoo/frame-ui/button';
import { EmptyState } from '@lingcoo/frame-ui/empty-state';
import { Skeleton, SkeletonText } from '@lingcoo/frame-ui/skeleton';
import { FileQuestion, RefreshCw, ServerCrash } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Section } from './Layout';
import { SeoHead } from './SeoHead';
import { SiteShell, type PublicPresentation } from './SiteShell';

export function PageLoading({
  label = '正在加载页面',
  presentation,
}: {
  label?: string;
  presentation: PublicPresentation | null;
}) {
  return (
    <SiteShell presentation={presentation}>
      <Section className="public-system-state" containerSize="content">
        <div aria-label={label} className="public-page-loading" role="status">
          <Skeleton style={{ height: 16, width: '28%' }} />
          <Skeleton style={{ height: 42, width: '64%' }} />
          <SkeletonText lines={4} />
          <Skeleton shape="block" style={{ minHeight: 220 }} />
        </div>
      </Section>
    </SiteShell>
  );
}

export function SystemPage({
  kind,
  presentation,
}: {
  kind: '404' | '500';
  presentation: PublicPresentation | null;
}) {
  const missing = kind === '404';
  return (
    <SiteShell presentation={presentation}>
      <SeoHead
        description={missing ? '请求的页面不存在或已被移动。' : '页面暂时无法加载。'}
        noIndex
        presentation={presentation}
        title={missing ? '页面未找到' : '服务暂不可用'}
      />
      <Section className="public-system-state" containerSize="content">
        <p className="public-system-code">{kind}</p>
        <EmptyState
          action={
            missing ? (
              <Button asChild>
                <a href="/">返回首页</a>
              </Button>
            ) : (
              <Button
                leadingIcon={<RefreshCw size={15} />}
                onClick={() => window.location.reload()}
              >
                重新加载
              </Button>
            )
          }
          description={
            missing
              ? '请检查地址是否正确，或从首页继续浏览。'
              : '请求未能完成，请稍后重新加载页面。'
          }
          icon={missing ? <FileQuestion size={30} /> : <ServerCrash size={30} />}
          title={missing ? '页面不存在' : '页面加载失败'}
          variant="error"
        />
      </Section>
    </SiteShell>
  );
}

export class PublicErrorBoundary extends Component<
  { children: ReactNode; presentation?: PublicPresentation | null },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Public web render failed', error, info.componentStack);
  }

  render() {
    if (this.state.failed)
      return <SystemPage kind="500" presentation={this.props.presentation ?? null} />;
    return this.props.children;
  }
}

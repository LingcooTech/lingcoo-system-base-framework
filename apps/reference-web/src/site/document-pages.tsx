import { BookOpenText, ChevronRight } from 'lucide-react';
import { ContentRenderer } from '@lingcoo/frame-cms/web';
import { PageHeader, Section } from '@lingcoo/frame-web/layout';
import type { PublicPresentation } from '@lingcoo/frame-web/presentation';
import { SeoHead } from '@lingcoo/frame-web/seo';
import { PageLoading, SystemPage } from '@lingcoo/frame-web/system-states';
import { useEffect, useState } from 'react';

import {
  loadReferenceDocument,
  referenceDocuments,
  type ReferenceDocument,
  type ReferenceDocumentMetadata,
} from './docs';
import { OfficialSite } from './pages';

export function DocsIndexPage({ presentation }: { presentation: PublicPresentation | null }) {
  const grouped = referenceDocuments.reduce<Record<string, ReferenceDocumentMetadata[]>>(
    (result, item) => {
      (result[item.section] ??= []).push(item);
      return result;
    },
    {},
  );
  return (
    <OfficialSite presentation={presentation}>
      <SeoHead canonicalPath="/docs" presentation={presentation} title="Frame 文档" />
      <Section className="reference-section">
        <PageHeader
          eyebrow="Documentation"
          title="把代码和架构对齐起来"
          description="文档直接从仓库版本读取，和当前 Frame 代码、包契约及实施进度一起发布。"
        />
        <div className="reference-doc-groups">
          {Object.entries(grouped).map(([section, items]) => (
            <section key={section}>
              <p className="reference-kicker">{section}</p>
              <div>
                {items.map((item) => (
                  <a className="reference-doc-link" href={`/docs/${item.slug}`} key={item.slug}>
                    <BookOpenText size={17} />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.summary}</small>
                    </span>
                    <ChevronRight size={15} />
                  </a>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Section>
    </OfficialSite>
  );
}

export function DocumentPage({
  presentation,
  slug,
}: {
  presentation: PublicPresentation | null;
  slug: string;
}) {
  const [state, setState] = useState<
    | { status: 'loading'; slug: string }
    | { status: 'ready'; slug: string; document: ReferenceDocument }
    | { status: 'missing'; slug: string }
    | { status: 'failed'; slug: string }
  >({ status: 'loading', slug });

  useEffect(() => {
    let active = true;
    loadReferenceDocument(slug)
      .then((document) => {
        if (active) {
          setState(document ? { status: 'ready', slug, document } : { status: 'missing', slug });
        }
      })
      .catch(() => {
        if (active) setState({ status: 'failed', slug });
      });
    return () => {
      active = false;
    };
  }, [slug]);

  if (state.slug !== slug || state.status === 'loading') {
    return <PageLoading label="正在加载 Frame 文档" presentation={presentation} />;
  }
  if (state.status === 'missing') return <SystemPage kind="404" presentation={presentation} />;
  if (state.status === 'failed') return <SystemPage kind="500" presentation={presentation} />;
  const { document } = state;
  return (
    <OfficialSite presentation={presentation}>
      <SeoHead
        canonicalPath={`/docs/${document.slug}`}
        description={document.summary}
        presentation={presentation}
        title={document.title}
      />
      <Section className="reference-doc-page" containerSize="content">
        <a className="reference-back-link" href="/docs">
          ← 全部文档
        </a>
        <PageHeader
          eyebrow={document.section}
          title={document.title}
          description={document.summary}
        />
        <article className="reference-markdown">
          <ContentRenderer content={document.body} />
        </article>
      </Section>
    </OfficialSite>
  );
}

import { Breadcrumb } from '@lingcootech/frame-ui/breadcrumb';
import { ResponsiveImage } from '@lingcootech/frame-ui/responsive-image';
import { PageHeader, Section } from '@lingcootech/frame-web/layout';
import type { PublicPresentation } from '@lingcootech/frame-web/presentation';
import { breadcrumbStructuredData, type StructuredData, SeoHead } from '@lingcootech/frame-web/seo';

import type { CmsPublicContent } from './web-client.js';
import { ContentRenderer } from './content-renderer.js';

export function ContentDetail({
  content,
  presentation,
  preview = false,
}: {
  content: CmsPublicContent;
  presentation: PublicPresentation | null;
  preview?: boolean;
}) {
  const baseUrl =
    presentation?.publicUrl ||
    (typeof window === 'undefined' ? 'http://localhost' : window.location.origin);
  const detailPath = `/${content.type === 'article' ? 'articles' : 'pages'}/${content.slug}`;
  const breadcrumbItems = [
    { href: '/', label: '首页' },
    ...(content.type === 'article' ? [{ href: '/articles', label: '文章' }] : []),
    { label: content.title },
  ];
  const coverUrl = content.coverAssetId ? content.assets[content.coverAssetId]?.publicUrl : null;
  const socialImageUrl = content.socialImageAssetId
    ? content.assets[content.socialImageAssetId]?.publicUrl
    : coverUrl;
  const structuredData: StructuredData[] = [breadcrumbStructuredData(baseUrl, breadcrumbItems)];
  if (content.type === 'article') {
    structuredData.push({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: content.title,
      description: content.seoDescription || content.excerpt || undefined,
      datePublished: content.publishedAt || undefined,
      author: content.author
        ? { '@type': 'Person', name: content.author.displayName }
        : { '@type': 'Organization', name: presentation?.displayName || 'Lingcoo Frame' },
      image: socialImageUrl || undefined,
      mainEntityOfPage: new URL(detailPath, baseUrl).toString(),
    });
  }
  return (
    <Section className="cms-public-page" containerSize="content">
      <SeoHead
        canonicalPath={detailPath}
        description={content.seoDescription || content.excerpt}
        image={socialImageUrl}
        noIndex={preview}
        presentation={presentation}
        structuredData={structuredData}
        title={content.seoTitle || content.title}
        type={content.type === 'article' ? 'article' : 'website'}
      />
      <div className="cms-public-header">
        <Breadcrumb items={breadcrumbItems} />
        {preview ? <span>草稿预览</span> : null}
      </div>
      <article>
        <PageHeader
          description={content.excerpt}
          eyebrow={content.type === 'page' ? 'Page' : 'Article'}
          meta={
            content.type === 'article' ? (
              <>
                <span>{content.author?.displayName || '系统编辑'}</span>
                {content.publishedAt ? (
                  <time dateTime={content.publishedAt}>
                    {new Date(content.publishedAt).toLocaleDateString()}
                  </time>
                ) : null}
              </>
            ) : null
          }
          title={content.title}
        />
        {coverUrl ? (
          <ResponsiveImage
            alt={content.title}
            aspectRatio="16 / 9"
            className="cms-public-cover"
            src={coverUrl}
            wrapperClassName="cms-public-cover-frame"
          />
        ) : null}
        {content.terms.length ? (
          <div className="cms-public-terms">
            {content.terms.map((term) => (
              <span key={term.id} style={term.color ? { borderColor: term.color } : undefined}>
                {term.name}
              </span>
            ))}
          </div>
        ) : null}
        <ContentRenderer content={content.body} />
      </article>
    </Section>
  );
}

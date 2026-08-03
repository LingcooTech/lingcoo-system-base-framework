import { ResponsiveImage } from '@lingcoo/frame-ui/responsive-image';

import type { CmsContent } from '../../types';

export function ArticleCard({ article }: { article: CmsContent }) {
  const coverUrl = article.coverAssetId ? article.assets[article.coverAssetId]?.publicUrl : null;
  return (
    <article className="cms-article-card">
      <a aria-label={`阅读${article.title}`} href={`/articles/${article.slug}`}>
        {coverUrl ? (
          <ResponsiveImage
            alt=""
            aspectRatio="16 / 9"
            className="cms-article-card__image"
            src={coverUrl}
            wrapperClassName="cms-article-card__media"
          />
        ) : null}
        <div className="cms-article-card__content">
          {article.publishedAt ? (
            <time dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleDateString()}
            </time>
          ) : null}
          <h2>{article.title}</h2>
          {article.excerpt ? <p>{article.excerpt}</p> : null}
        </div>
      </a>
    </article>
  );
}

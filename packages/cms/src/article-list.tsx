import type { CmsPublicContent } from './web-client.js';
import { ArticleCard } from './article-card.js';
import { EmptyContent } from './empty-content.js';

export function ArticleList({ items }: { items: CmsPublicContent[] }) {
  if (!items.length) {
    return <EmptyContent />;
  }
  return (
    <div className="cms-article-list">
      {items.map((item) => (
        <ArticleCard article={item} key={item.id} />
      ))}
    </div>
  );
}

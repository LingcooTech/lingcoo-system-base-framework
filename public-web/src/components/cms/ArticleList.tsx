import type { CmsContent } from '../../types';
import { ArticleCard } from './ArticleCard';
import { EmptyContent } from './EmptyContent';

export function ArticleList({ items }: { items: CmsContent[] }) {
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

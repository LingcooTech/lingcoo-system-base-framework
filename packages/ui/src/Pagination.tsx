import { type ReactNode } from 'react';

import { cx } from './lib/cx';

type PageItem = number | 'ellipsis';

function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((value) => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);
  const result: PageItem[] = [];
  for (const value of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === 'number' && value - previous > 1) result.push('ellipsis');
    result.push(value);
  }
  return result;
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange?: (page: number) => void;
  hrefForPage?: (page: number) => string;
  label?: string;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  className?: string;
}

export function Pagination({
  className,
  hrefForPage,
  label = '分页导航',
  nextLabel = '下一页',
  onPageChange,
  page,
  pageCount,
  previousLabel = '上一页',
}: PaginationProps) {
  if (pageCount <= 1) return null;
  const current = Math.min(Math.max(page, 1), pageCount);
  const renderControl = (
    target: number,
    content: ReactNode,
    currentPage = false,
    disabled = false,
  ) => {
    const shared = {
      className: cx('lc-pagination__item', currentPage && 'is-current'),
      'aria-current': currentPage ? ('page' as const) : undefined,
      'aria-disabled': disabled || undefined,
    };
    if (hrefForPage && !disabled) {
      return (
        <a {...shared} href={hrefForPage(target)}>
          {content}
        </a>
      );
    }
    return (
      <button {...shared} disabled={disabled} onClick={() => onPageChange?.(target)} type="button">
        {content}
      </button>
    );
  };
  return (
    <nav aria-label={label} className={cx('lc-pagination', className)}>
      {renderControl(current - 1, previousLabel, false, current === 1)}
      <div className="lc-pagination__pages">
        {pageItems(current, pageCount).map((item, index) =>
          item === 'ellipsis' ? (
            <span aria-hidden className="lc-pagination__ellipsis" key={`ellipsis-${index}`}>
              …
            </span>
          ) : (
            <span key={item}>{renderControl(item, item, item === current)}</span>
          ),
        )}
      </div>
      {renderControl(current + 1, nextLabel, false, current === pageCount)}
    </nav>
  );
}

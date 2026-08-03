import { Pagination } from '@lingcoo/frame-ui/pagination';

export function AdminPagination({
  onPageChange,
  page,
  pageSize,
  total,
}: {
  onPageChange(page: number): void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pagination">
      <span>
        第 {page} / {pageCount} 页 · 共 {total} 条
      </span>
      <Pagination
        nextLabel="下一页"
        onPageChange={onPageChange}
        page={page}
        pageCount={pageCount}
        previousLabel="上一页"
      />
    </div>
  );
}

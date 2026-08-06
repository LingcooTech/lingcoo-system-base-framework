import { EmptyState } from '@lingcoo/frame-ui/empty-state';
import { Checkbox } from '@lingcoo/frame-ui/checkbox';
import { Skeleton } from '@lingcoo/frame-ui/skeleton';
import type { ReactNode } from 'react';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  cell(row: Row): ReactNode;
  align?: 'left' | 'right';
}

export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  emptyTitle = '暂无资源',
  loading = false,
  onSelectionChange,
  selectedKeys = [],
}: {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey(row: Row): string;
  emptyTitle?: string;
  loading?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  selectedKeys?: string[];
}) {
  if (!loading && rows.length === 0) {
    return <EmptyState compact title={emptyTitle} />;
  }
  const selectable = Boolean(onSelectionChange);
  const rowKeys = rows.map(getRowKey);
  const allSelected = rowKeys.length > 0 && rowKeys.every((key) => selectedKeys.includes(key));
  const someSelected = rowKeys.some((key) => selectedKeys.includes(key));
  const toggle = (key: string, checked: boolean) =>
    onSelectionChange?.(
      checked ? [...new Set([...selectedKeys, key])] : selectedKeys.filter((item) => item !== key),
    );
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="data-table__selection">
                <Checkbox
                  aria-label="选择当前页全部项目"
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) =>
                    onSelectionChange?.(
                      checked === true
                        ? [...new Set([...selectedKeys, ...rowKeys])]
                        : selectedKeys.filter((key) => !rowKeys.includes(key)),
                    )
                  }
                />
              </th>
            ) : null}
            {columns.map((column) => (
              <th className={column.align === 'right' ? 'align-right' : undefined} key={column.key}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, rowIndex) => (
                <tr key={`loading-${rowIndex}`}>
                  {selectable ? <td className="data-table__selection" /> : null}
                  {columns.map((column) => (
                    <td key={column.key}>
                      <Skeleton
                        style={{ height: 18, width: column.align === 'right' ? 70 : '80%' }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  data-selected={selectedKeys.includes(getRowKey(row)) || undefined}
                  key={getRowKey(row)}
                >
                  {selectable ? (
                    <td className="data-table__selection">
                      <Checkbox
                        aria-label="选择项目"
                        checked={selectedKeys.includes(getRowKey(row))}
                        onCheckedChange={(checked) => toggle(getRowKey(row), checked === true)}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      className={column.align === 'right' ? 'align-right' : undefined}
                      key={column.key}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

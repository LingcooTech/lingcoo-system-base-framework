import { EmptyState } from '@lingcoo/frame-ui/empty-state';
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
}: {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey(row: Row): string;
  emptyTitle?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState compact title={emptyTitle} />;
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th className={column.align === 'right' ? 'align-right' : undefined} key={column.key}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
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

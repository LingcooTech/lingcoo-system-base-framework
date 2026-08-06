import { Button } from '@lingcoo/frame-ui/button';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export function BulkActionBar({
  children,
  onClear,
  selectedCount,
}: {
  children: ReactNode;
  onClear(): void;
  selectedCount: number;
}) {
  if (!selectedCount) return null;
  return (
    <div className="admin-bulk-bar" role="region" aria-label="批量操作">
      <strong>已选择 {selectedCount} 项</strong>
      <div>{children}</div>
      <Button aria-label="清除选择" onClick={onClear} size="sm" variant="ghost">
        <X size={15} />
      </Button>
    </div>
  );
}

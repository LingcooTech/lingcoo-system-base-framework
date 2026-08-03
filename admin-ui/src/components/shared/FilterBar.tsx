import { Search, X } from 'lucide-react';
import type { FormHTMLAttributes, ReactNode } from 'react';

import { Button } from '@lingcoo/frame-ui/button';

export function FilterBar({
  actions,
  children,
  onReset,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  actions?: ReactNode;
  onReset?: () => void;
}) {
  return (
    <form className="admin-filter-bar" {...props}>
      <Search aria-hidden size={16} />
      <div className="admin-filter-bar__fields">{children}</div>
      <div className="admin-filter-bar__actions">
        {onReset ? (
          <Button aria-label="重置筛选" onClick={onReset} size="sm" type="button" variant="ghost">
            <X size={15} />
          </Button>
        ) : null}
        {actions}
      </div>
    </form>
  );
}

import { type HTMLAttributes, type ReactNode } from 'react';

import { Spinner } from './Spinner';
import { cx } from './lib/cx';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'empty' | 'loading' | 'error';
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  action,
  className,
  compact = false,
  description,
  icon,
  title,
  variant = 'empty',
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'lc-empty-state',
        `lc-empty-state--${variant}`,
        compact && 'lc-empty-state--compact',
        className,
      )}
      role={variant === 'error' ? 'alert' : 'status'}
      {...rest}
    >
      <div className="lc-empty-state__media" aria-hidden>
        {variant === 'loading' ? <Spinner size="lg" /> : icon}
      </div>
      {title ? <p className="lc-empty-state__title">{title}</p> : null}
      {description ? <p className="lc-empty-state__description">{description}</p> : null}
      {action ? <div className="lc-empty-state__action">{action}</div> : null}
    </div>
  );
}

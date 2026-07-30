import { type HTMLAttributes } from 'react';

import { cx } from './lib/cx';

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ className, dot = false, tone = 'neutral', children, ...rest }: BadgeProps) {
  return (
    <span className={cx('lc-badge', `lc-badge--${tone}`, className)} {...rest}>
      {dot ? <span aria-hidden className="lc-badge__dot" /> : null}
      {children}
    </span>
  );
}

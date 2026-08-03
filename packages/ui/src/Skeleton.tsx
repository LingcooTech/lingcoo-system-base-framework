import { forwardRef, type HTMLAttributes } from 'react';

import { cx } from './lib/cx';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  shape?: 'line' | 'circle' | 'block';
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, shape = 'line', ...rest }, ref) => (
    <div
      ref={ref}
      aria-hidden
      className={cx('lc-skeleton', `lc-skeleton--${shape}`, className)}
      {...rest}
    />
  ),
);
Skeleton.displayName = 'Skeleton';

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-hidden className="lc-skeleton-text">
      {Array.from({ length: Math.max(1, lines) }, (_, index) => (
        <Skeleton key={index} style={index === lines - 1 ? { width: '72%' } : undefined} />
      ))}
    </div>
  );
}

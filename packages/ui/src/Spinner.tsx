import { cx } from './lib/cx';

export function Spinner({
  size = 'md',
  label = '加载中',
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}) {
  return (
    <span className={cx('lc-spinner-wrap', className)} role="status">
      <span aria-hidden className={cx('lc-spinner', `lc-spinner--${size}`)} />
      <span className="lc-visually-hidden">{label}</span>
    </span>
  );
}

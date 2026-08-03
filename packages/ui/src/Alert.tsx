import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from './lib/cx';

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ action, children, className, icon, role, title, tone = 'info', ...rest }, ref) => (
    <div
      ref={ref}
      className={cx('lc-alert', `lc-alert--${tone}`, className)}
      role={role ?? (tone === 'danger' ? 'alert' : 'status')}
      {...rest}
    >
      {icon ? <span className="lc-alert__icon">{icon}</span> : null}
      <div className="lc-alert__content">
        {title ? <p className="lc-alert__title">{title}</p> : null}
        {children ? <div className="lc-alert__description">{children}</div> : null}
      </div>
      {action ? <div className="lc-alert__action">{action}</div> : null}
    </div>
  ),
);
Alert.displayName = 'Alert';

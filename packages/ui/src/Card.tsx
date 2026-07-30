import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from './lib/cx';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  raised?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padded = false, raised = false, ...rest }, ref) => (
    <div
      ref={ref}
      className={cx('lc-card', padded && 'lc-card--padded', raised && 'lc-card--raised', className)}
      {...rest}
    />
  ),
);
Card.displayName = 'Card';

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="lc-card__header">
      <div>
        <h3 className="lc-card__title">{title}</h3>
        {description ? <p className="lc-card__description">{description}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

export const CardBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...rest }, ref) => (
    <div ref={ref} className={cx('lc-card__body', className)} {...rest} />
  ),
);
CardBody.displayName = 'CardBody';

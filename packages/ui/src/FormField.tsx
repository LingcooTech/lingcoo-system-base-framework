import { useId, type ReactNode } from 'react';

import { cx } from './lib/cx';

export function FormField({
  label,
  description,
  error,
  required = false,
  className,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children:
    | ReactNode
    | ((ids: { controlId: string; descriptionId?: string; errorId?: string }) => ReactNode);
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={cx('lc-form-field', className)}>
      <label className="lc-form-field__label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </label>
      {typeof children === 'function'
        ? children({ controlId: id, descriptionId, errorId })
        : children}
      {description ? (
        <p className="lc-form-field__description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      {error ? (
        <p className="lc-form-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

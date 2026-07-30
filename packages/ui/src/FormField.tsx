import { useId, type ReactNode } from 'react';

export function FormField({
  label,
  description,
  error,
  required = false,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: (ids: { controlId: string; descriptionId?: string; errorId?: string }) => ReactNode;
}) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="lc-form-field">
      <label className="lc-form-field__label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </label>
      {children({ controlId: id, descriptionId, errorId })}
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

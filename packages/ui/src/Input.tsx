import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

import { cx } from './lib/cx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, disabled, invalid = false, prefix, suffix, wrapperClassName, ...rest }, ref) => (
    <span
      className={cx(
        'lc-input-frame',
        invalid && 'lc-input-frame--invalid',
        disabled && 'lc-input-frame--disabled',
        wrapperClassName,
      )}
    >
      {prefix ? <span className="lc-input__affix">{prefix}</span> : null}
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx('lc-input', className)}
        disabled={disabled}
        {...rest}
      />
      {suffix ? <span className="lc-input__affix">{suffix}</span> : null}
    </span>
  ),
);
Input.displayName = 'Input';

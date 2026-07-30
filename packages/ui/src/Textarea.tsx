import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cx } from './lib/cx';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, ...rest }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx('lc-textarea', invalid && 'lc-textarea--invalid', className)}
      {...rest}
    />
  ),
);
Textarea.displayName = 'Textarea';

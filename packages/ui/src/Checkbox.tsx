import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cx } from './lib/cx';

export interface CheckboxProps extends Omit<
  ComponentPropsWithoutRef<typeof RadixCheckbox.Root>,
  'children'
> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, description, id, label, ...rest }, ref) => {
    const control = (
      <RadixCheckbox.Root ref={ref} className={cx('lc-checkbox', className)} id={id} {...rest}>
        <RadixCheckbox.Indicator className="lc-checkbox__indicator">✓</RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
    );
    if (!label && !description) return control;
    return (
      <label className="lc-choice-field" htmlFor={id}>
        {control}
        <span>
          {label ? <span className="lc-choice-field__label">{label}</span> : null}
          {description ? <span className="lc-choice-field__description">{description}</span> : null}
        </span>
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';

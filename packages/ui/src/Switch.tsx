import * as RadixSwitch from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cx } from './lib/cx';

export interface SwitchProps extends Omit<
  ComponentPropsWithoutRef<typeof RadixSwitch.Root>,
  'children'
> {
  label?: ReactNode;
  description?: ReactNode;
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, description, id, label, ...rest }, ref) => {
    const control = (
      <RadixSwitch.Root ref={ref} className={cx('lc-switch', className)} id={id} {...rest}>
        <RadixSwitch.Thumb className="lc-switch__thumb" />
      </RadixSwitch.Root>
    );
    if (!label && !description) return control;
    return (
      <label className="lc-switch-field" htmlFor={id}>
        <span>
          {label ? <span className="lc-choice-field__label">{label}</span> : null}
          {description ? <span className="lc-choice-field__description">{description}</span> : null}
        </span>
        {control}
      </label>
    );
  },
);
Switch.displayName = 'Switch';

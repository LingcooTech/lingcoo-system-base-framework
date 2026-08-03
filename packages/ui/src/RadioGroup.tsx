import * as RadixRadioGroup from '@radix-ui/react-radio-group';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cx } from './lib/cx';

export const RadioGroup = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixRadioGroup.Root>
>(({ className, ...rest }, ref) => (
  <RadixRadioGroup.Root ref={ref} className={cx('lc-radio-group', className)} {...rest} />
));
RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps extends Omit<
  ComponentPropsWithoutRef<typeof RadixRadioGroup.Item>,
  'children'
> {
  label?: ReactNode;
  description?: ReactNode;
}

export const RadioGroupItem = forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, description, id, label, ...rest }, ref) => {
    const control = (
      <RadixRadioGroup.Item ref={ref} className={cx('lc-radio', className)} id={id} {...rest}>
        <RadixRadioGroup.Indicator className="lc-radio__indicator" />
      </RadixRadioGroup.Item>
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
RadioGroupItem.displayName = 'RadioGroupItem';

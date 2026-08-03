import * as RadixSelect from '@radix-ui/react-select';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cx } from './lib/cx';

export const Select = RadixSelect.Root;
export const SelectGroup = RadixSelect.Group;
export const SelectValue = RadixSelect.Value;

export const SelectTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixSelect.Trigger>
>(({ children, className, ...rest }, ref) => (
  <RadixSelect.Trigger ref={ref} className={cx('lc-select-trigger', className)} {...rest}>
    <span className="lc-select-value">{children}</span>
    <RadixSelect.Icon className="lc-select-icon">⌄</RadixSelect.Icon>
  </RadixSelect.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixSelect.Content>
>(({ children, className, position = 'popper', sideOffset = 6, ...rest }, ref) => (
  <RadixSelect.Portal>
    <RadixSelect.Content
      ref={ref}
      className={cx('lc-select-content', className)}
      position={position}
      sideOffset={sideOffset}
      {...rest}
    >
      <RadixSelect.Viewport className="lc-select-viewport">{children}</RadixSelect.Viewport>
    </RadixSelect.Content>
  </RadixSelect.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectLabel = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixSelect.Label>
>(({ className, ...rest }, ref) => (
  <RadixSelect.Label ref={ref} className={cx('lc-select-label', className)} {...rest} />
));
SelectLabel.displayName = 'SelectLabel';

export const SelectItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixSelect.Item>
>(({ children, className, ...rest }, ref) => (
  <RadixSelect.Item ref={ref} className={cx('lc-select-item', className)} {...rest}>
    <RadixSelect.ItemIndicator className="lc-select-check">✓</RadixSelect.ItemIndicator>
    <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
  </RadixSelect.Item>
));
SelectItem.displayName = 'SelectItem';

export function SelectSeparator({ className }: { className?: string }) {
  return <RadixSelect.Separator className={cx('lc-select-separator', className)} />;
}

export function SelectField({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="lc-form-field">
      <span className="lc-form-field__label">{label}</span>
      {children}
      {description ? <p className="lc-form-field__description">{description}</p> : null}
    </div>
  );
}

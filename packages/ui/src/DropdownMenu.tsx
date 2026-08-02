import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import { cx } from './lib/cx';

export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;
export const DropdownMenuGroup = RadixDropdownMenu.Group;

export const DropdownMenuContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>
>(({ align = 'start', className, sideOffset = 8, ...rest }, ref) => (
  <RadixDropdownMenu.Portal>
    <RadixDropdownMenu.Content
      ref={ref}
      align={align}
      className={cx('lc-dropdown-content', className)}
      sideOffset={sideOffset}
      {...rest}
    />
  </RadixDropdownMenu.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item> & { tone?: 'default' | 'danger' }
>(({ className, tone = 'default', ...rest }, ref) => (
  <RadixDropdownMenu.Item
    ref={ref}
    className={cx('lc-dropdown-item', `lc-dropdown-item--${tone}`, className)}
    {...rest}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.Label>
>(({ className, ...rest }, ref) => (
  <RadixDropdownMenu.Label ref={ref} className={cx('lc-dropdown-label', className)} {...rest} />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.Separator>
>(({ className, ...rest }, ref) => (
  <RadixDropdownMenu.Separator
    ref={ref}
    className={cx('lc-dropdown-separator', className)}
    {...rest}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

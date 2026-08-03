import * as RadixPopover from '@radix-ui/react-popover';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import { cx } from './lib/cx';

export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;
export const PopoverClose = RadixPopover.Close;

export const PopoverContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixPopover.Content>
>(({ align = 'center', className, sideOffset = 8, ...rest }, ref) => (
  <RadixPopover.Portal>
    <RadixPopover.Content
      ref={ref}
      align={align}
      className={cx('lc-popover-content', className)}
      sideOffset={sideOffset}
      {...rest}
    />
  </RadixPopover.Portal>
));
PopoverContent.displayName = 'PopoverContent';

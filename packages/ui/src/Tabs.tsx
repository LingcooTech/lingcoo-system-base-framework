import * as RadixTabs from '@radix-ui/react-tabs';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';

import { cx } from './lib/cx';

export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof RadixTabs.List>>(
  ({ className, ...rest }, ref) => (
    <RadixTabs.List ref={ref} className={cx('lc-tabs-list', className)} {...rest} />
  ),
);
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...rest }, ref) => (
  <RadixTabs.Trigger ref={ref} className={cx('lc-tabs-trigger', className)} {...rest} />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...rest }, ref) => (
  <RadixTabs.Content ref={ref} className={cx('lc-tabs-content', className)} {...rest} />
));
TabsContent.displayName = 'TabsContent';

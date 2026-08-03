import * as RadixDialog from '@radix-ui/react-dialog';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cx } from './lib/cx';

export const Drawer = RadixDialog.Root;
export const DrawerTrigger = RadixDialog.Trigger;
export const DrawerClose = RadixDialog.Close;

export const DrawerContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
    side?: 'left' | 'right' | 'bottom';
    header?: ReactNode;
    footer?: ReactNode;
  }
>(({ children, className, footer, header, side = 'right', ...rest }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="lc-drawer-overlay" />
    <RadixDialog.Content
      ref={ref}
      className={cx('lc-drawer-content', `lc-drawer-content--${side}`, className)}
      {...rest}
    >
      {header}
      <div className="lc-drawer-body">{children}</div>
      {footer}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
DrawerContent.displayName = 'DrawerContent';

export function DrawerHeader({
  title,
  description,
  closable = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  closable?: boolean;
}) {
  return (
    <div className="lc-drawer-header">
      <div>
        <RadixDialog.Title className="lc-drawer-title">{title}</RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className="lc-drawer-description">
            {description}
          </RadixDialog.Description>
        ) : null}
      </div>
      {closable ? (
        <RadixDialog.Close aria-label="关闭" className="lc-drawer-close">
          ×
        </RadixDialog.Close>
      ) : null}
    </div>
  );
}

export function DrawerFooter({ children }: { children: ReactNode }) {
  return <div className="lc-drawer-footer">{children}</div>;
}

import * as RadixDialog from '@radix-ui/react-dialog';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';

import { cx } from './lib/cx';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

export const DialogContent = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof RadixDialog.Content> & {
    size?: 'sm' | 'md' | 'lg';
    header?: ReactNode;
    footer?: ReactNode;
  }
>(({ children, className, footer, header, size = 'md', ...rest }, ref) => (
  <RadixDialog.Portal>
    <RadixDialog.Overlay className="lc-dialog-overlay" />
    <RadixDialog.Content
      ref={ref}
      className={cx('lc-dialog-content', `lc-dialog-content--${size}`, className)}
      {...rest}
    >
      {header}
      <div className="lc-dialog-body">{children}</div>
      {footer}
    </RadixDialog.Content>
  </RadixDialog.Portal>
));
DialogContent.displayName = 'DialogContent';

export function DialogHeader({
  title,
  description,
  closable = true,
}: {
  title: ReactNode;
  description?: ReactNode;
  closable?: boolean;
}) {
  return (
    <div className="lc-dialog-header">
      <div>
        <RadixDialog.Title className="lc-dialog-title">{title}</RadixDialog.Title>
        {description ? (
          <RadixDialog.Description className="lc-dialog-description">
            {description}
          </RadixDialog.Description>
        ) : null}
      </div>
      {closable ? (
        <RadixDialog.Close aria-label="关闭" className="lc-dialog-close">
          ×
        </RadixDialog.Close>
      ) : null}
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="lc-dialog-footer">{children}</div>;
}

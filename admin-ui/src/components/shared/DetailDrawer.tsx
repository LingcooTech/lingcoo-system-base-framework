import { Drawer, DrawerContent, DrawerFooter, DrawerHeader } from '@lingcoo/frame-ui/drawer';
import type { ReactNode } from 'react';

export function DetailDrawer({
  children,
  description,
  footer,
  onOpenChange,
  open,
  title,
}: {
  children: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  onOpenChange(open: boolean): void;
  open: boolean;
  title: ReactNode;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="admin-detail-drawer"
        footer={footer ? <DrawerFooter>{footer}</DrawerFooter> : undefined}
        header={<DrawerHeader description={description} title={title} />}
      >
        {children}
      </DrawerContent>
    </Drawer>
  );
}

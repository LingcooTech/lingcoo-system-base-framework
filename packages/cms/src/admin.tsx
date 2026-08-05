import { defineAdminExtension, type AdminRouteComponent } from '@lingcoo/frame-admin';
import type { ComponentType } from 'react';

export function createCmsAdminExtension<TContext>(options: {
  component: AdminRouteComponent<TContext>;
  icon?: ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;
}) {
  return defineAdminExtension<TContext>({
    routes: [{ id: 'frame-cms.content', component: options.component }],
    navigation: [{ id: 'frame-cms.content', icon: options.icon }],
  });
}

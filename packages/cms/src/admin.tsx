import { defineAdminExtension, type AdminRouteComponent } from '@lingcoo/frame-admin';
import type { AdminPageSection } from '@lingcoo/frame-admin/shared';
import { BookOpenText } from 'lucide-react';
import type { ComponentType } from 'react';

import { createCmsAdminClient, type CmsAdminClient } from './admin-client.js';
import { CmsAdminPage } from './admin-page.js';

export function createCmsAdminExtension<TContext>(options: {
  client: CmsAdminClient;
  component?: AdminRouteComponent<TContext>;
  icon?: ComponentType<{ className?: string; size?: number; 'aria-hidden'?: boolean }>;
  previewHref?: (contentId: string) => string;
  section?: AdminPageSection;
}) {
  const DefaultCmsPage: AdminRouteComponent<TContext> = () => (
    <CmsAdminPage
      client={options.client}
      previewHref={options.previewHref}
      section={options.section}
    />
  );
  return defineAdminExtension<TContext>({
    routes: [{ id: 'frame-cms.content', component: options.component ?? DefaultCmsPage }],
    navigation: [{ id: 'frame-cms.content', icon: options.icon ?? BookOpenText }],
  });
}

export { createCmsAdminClient, CmsAdminPage };
export { defaultCmsAdminSection } from './admin-page.js';
export type {
  CmsAdminAsset,
  CmsAdminClient,
  CmsAdminRequest,
  CmsContent,
  CmsContentFilters,
  CmsContentInput,
  CmsPresentationAsset,
  CmsPresentationProfile,
  CmsRedirect,
  CmsRedirectInput,
  CmsTaxonomy,
  CmsTaxonomyTerm,
  CmsTerm,
  CmsVersion,
} from './admin-client.js';

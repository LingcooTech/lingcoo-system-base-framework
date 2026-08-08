import { defineExtension, FRAME_VERSION } from '@lingcoo/frame-extension-sdk';
import { defineServerExtension } from '@lingcoo/frame-extension-sdk/server';

interface PublicSiteApp {
  publicSiteRegistry: {
    registerSitemapCollector(
      id: string,
      collector: () => Promise<readonly { path: string }[]>,
    ): void;
  };
}

const referencePublicPaths = [
  '/',
  '/framework',
  '/architecture',
  '/packages',
  '/extensions',
  '/docs',
  '/docs/architecture',
  '/docs/platform-roadmap',
  '/docs/extension-development',
  '/docs/domain-extension',
  '/docs/package-contracts',
  '/docs/frontend-foundation',
  '/docs/capability-matrix',
  '/docs/identity-access',
  '/docs/account-security',
  '/docs/cms-lite',
  '/docs/presentation',
  '/docs/media-assets',
  '/docs/integration-foundation',
  '/docs/shared-providers',
  '/docs/jobs-notifications',
  '/docs/observability',
  '/docs/metadata-search-exchange',
  '/docs/settings-audit',
  '/docs/reference-experience-roadmap',
  '/releases',
] as const;

export const referenceSiteServerExtension = defineExtension({
  manifest: {
    id: 'frame-reference-site',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    dependencies: [{ id: 'frame', version: `^${FRAME_VERSION}` }],
  },
  server: defineServerExtension<PublicSiteApp>({
    register({ app }) {
      app.publicSiteRegistry.registerSitemapCollector('frame-reference-site.static', async () =>
        referencePublicPaths.map((path) => ({ path })),
      );
    },
  }),
});

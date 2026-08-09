import '@lingcootech/frame-design-tokens/base.css';
import '@lingcootech/frame-ui/styles.css';
import '@lingcootech/frame-admin/styles.css';
import '@lingcootech/frame-web/styles.css';
import '@lingcootech/frame-cms/styles.css';

import { frameCoreManifest } from '@lingcootech/frame/manifest';
import { Button } from '@lingcootech/frame-ui/button';
import { AdminAuthProvider, type AdminAuthClient } from '@lingcootech/frame-admin/auth';
import { AdminApplicationShell } from '@lingcootech/frame-admin/layout';
import { createAdminRegistry } from '@lingcootech/frame-admin';
import { AdminRouterProvider } from '@lingcootech/frame-admin/router';
import {
  AdminSystemInfoPage,
  type AdminSystemInfoClient,
} from '@lingcootech/frame-admin/system-info';
import { createCmsAdminClient, createCmsAdminExtension } from '@lingcootech/frame-cms/admin';
import { cmsManifest } from '@lingcootech/frame-cms/contracts';
import { createCmsWebClient, createCmsWebExtension } from '@lingcootech/frame-cms/web';
import { createWebRegistry } from '@lingcootech/frame-web';
import { PageHeader, Section } from '@lingcootech/frame-web/layout';
import type { PublicPresentation } from '@lingcootech/frame-web/presentation';
import { SiteShell } from '@lingcootech/frame-web/site';
import { exampleAdminExtension } from '@lingcootech/frame-example-extension/admin';
import { exampleManifest } from '@lingcootech/frame-example-extension/contracts';
import { exampleWebExtension } from '@lingcootech/frame-example-extension/web';
import {
  defineExtension,
  defineSystem,
  projectExtensionManifest,
} from '@lingcootech/frame-extension-sdk';

const frameDependency = defineExtension({
  manifest: projectExtensionManifest(frameCoreManifest, []),
});

const cmsAdminClient = createCmsAdminClient(async () => {
  throw new Error('Consumer must connect its authenticated Admin API transport');
});

const cmsWebClient = createCmsWebClient((path, init) => fetch(path, init));

export const consumerAdminRegistry = createAdminRegistry(
  defineSystem({
    id: 'consumer-admin',
    version: '0.1.0',
    extensions: [
      frameDependency,
      defineExtension({
        manifest: projectExtensionManifest(cmsManifest, ['admin']),
        admin: createCmsAdminExtension({ client: cmsAdminClient }),
      }),
      defineExtension({
        manifest: projectExtensionManifest(exampleManifest, ['admin']),
        admin: exampleAdminExtension,
      }),
    ],
  }),
);

export const consumerWebRegistry = createWebRegistry(
  defineSystem({
    id: 'consumer-web',
    version: '0.1.0',
    extensions: [
      frameDependency,
      defineExtension({
        manifest: projectExtensionManifest(cmsManifest, ['web']),
        web: createCmsWebExtension({
          client: cmsWebClient,
          resolvePresentation: () => null,
        }),
      }),
      defineExtension({
        manifest: projectExtensionManifest(exampleManifest, ['web']),
        web: exampleWebExtension,
      }),
    ],
  }),
);

export function ConsumerButton() {
  return <Button>Consumer action</Button>;
}

export function ConsumerAdminShell({
  authClient,
  children,
}: {
  authClient: AdminAuthClient;
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider client={authClient}>
      <AdminRouterProvider>
        <AdminApplicationShell context={{}} frame={{ name: 'Lingcoo Frame', version: '0.7.1' }}>
          {children}
        </AdminApplicationShell>
      </AdminRouterProvider>
    </AdminAuthProvider>
  );
}

const systemInfoClient: AdminSystemInfoClient = {
  async loadRuntime() {
    throw new Error('Consumer must connect its system runtime API');
  },
};

export function ConsumerSystemInfo() {
  return <AdminSystemInfoPage client={systemInfoClient} />;
}

const presentation: PublicPresentation = {
  displayName: 'Consumer System',
  shortName: 'CS',
  slogan: 'Built on Frame',
  fullLogoAssetId: null,
  squareLogoAssetId: null,
  darkLogoAssetId: null,
  faviconAssetId: null,
  socialImageAssetId: null,
  primaryColor: '#315f47',
  secondaryColor: '#b9efc5',
  accentColor: '#39735a',
  contactEmail: null,
  contactPhone: null,
  contactAddress: null,
  publicUrl: 'https://consumer.example.test',
  seoTitle: 'Consumer System',
  seoDescription: 'A Frame consumer.',
  headerNavigation: [],
  footerLinks: [],
  footerCopyright: null,
  filingInfo: null,
  assets: {},
};

export function ConsumerPublicSite() {
  return (
    <SiteShell presentation={presentation}>
      <Section>
        <PageHeader title="Consumer home" />
      </Section>
    </SiteShell>
  );
}

import '@lingcoo/frame-design-tokens/base.css';
import '@lingcoo/frame-ui/styles.css';
import '@lingcoo/frame-web/styles.css';

import { frameCoreManifest } from '@lingcoo/frame/manifest';
import { Button } from '@lingcoo/frame-ui/button';
import { createAdminRegistry } from '@lingcoo/frame-admin';
import { createWebRegistry } from '@lingcoo/frame-web';
import { PageHeader, Section } from '@lingcoo/frame-web/layout';
import type { PublicPresentation } from '@lingcoo/frame-web/presentation';
import { SiteShell } from '@lingcoo/frame-web/site';
import { exampleAdminExtension } from '@lingcoo/frame-example-extension/admin';
import { exampleManifest } from '@lingcoo/frame-example-extension/contracts';
import { exampleWebExtension } from '@lingcoo/frame-example-extension/web';
import {
  defineExtension,
  defineSystem,
  projectExtensionManifest,
} from '@lingcoo/frame-extension-sdk';

const frameDependency = defineExtension({
  manifest: projectExtensionManifest(frameCoreManifest, []),
});

export const consumerAdminRegistry = createAdminRegistry(
  defineSystem({
    id: 'consumer-admin',
    version: '0.1.0',
    extensions: [
      frameDependency,
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
        manifest: projectExtensionManifest(exampleManifest, ['web']),
        web: exampleWebExtension,
      }),
    ],
  }),
);

export function ConsumerButton() {
  return <Button>Consumer action</Button>;
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

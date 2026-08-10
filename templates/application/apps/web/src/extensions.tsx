// <cms>
import { cmsManifest } from '@lingcootech/frame-cms/contracts';
import { createCmsWebClient, createCmsWebExtension } from '@lingcootech/frame-cms/web';
// </cms>
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
} from '@lingcootech/frame-extension-sdk';
import { createWebRegistry, defineWebExtension } from '@lingcootech/frame-web';
import { frameWebManifest } from '@lingcootech/frame-web/manifest';
import type { PublicPresentation } from '@lingcootech/frame-web/presentation';
import { domainManifest } from '__PACKAGE_SCOPE__/__PROJECT_NAME__-domain/contracts';
import { domainWebExtension } from '__PACKAGE_SCOPE__/__PROJECT_NAME__-domain/web';

export interface PublicWebContext {
  presentation: PublicPresentation | null;
}

const frameDefinition = defineExtension({
  manifest: {
    id: 'frame',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    web: frameWebManifest,
  },
  web: defineWebExtension<PublicWebContext>({}),
});

// <cms>
const cmsDefinition = defineExtension({
  manifest: projectExtensionManifest(cmsManifest, ['web']),
  web: createCmsWebExtension<PublicWebContext>({
    client: createCmsWebClient((requestPath, init) => fetch(requestPath, init)),
    resolvePresentation: (context) => context.presentation,
  }),
});
// </cms>

const domainDefinition = defineExtension({
  manifest: projectExtensionManifest(domainManifest, ['web']),
  web: domainWebExtension,
});

export const publicWebSystem = defineSystem({
  id: '__SYSTEM_ID__-web',
  version: '0.1.0',
  extensions: [
    frameDefinition,
    // <cms>
    cmsDefinition,
    // </cms>
    domainDefinition,
  ],
});

export const webRegistry = createWebRegistry<PublicWebContext>(publicWebSystem);

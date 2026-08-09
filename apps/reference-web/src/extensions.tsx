import { cmsManifest } from '@lingcootech/frame-cms/contracts';
import { createCmsWebClient, createCmsWebExtension } from '@lingcootech/frame-cms/web';
import {
  defineExtension,
  defineSystem,
  FRAME_VERSION,
  projectExtensionManifest,
} from '@lingcootech/frame-extension-sdk';
import { createWebRegistry, defineWebExtension } from '@lingcootech/frame-web';
import { frameWebManifest } from '@lingcootech/frame-web/manifest';
import type { PublicPresentation } from '@lingcootech/frame-web/presentation';

import { AuthRoute } from './auth-route';
import { referenceSiteDefinition } from './site/extension';

export interface PublicWebContext {
  presentation: PublicPresentation | null;
}

const frameWebDefinition = defineExtension({
  manifest: {
    id: 'frame',
    version: FRAME_VERSION,
    apiVersion: '1',
    frame: `^${FRAME_VERSION}`,
    web: frameWebManifest,
  },
  web: defineWebExtension<PublicWebContext>({
    routes: [{ id: 'frame.auth', component: AuthRoute }],
  }),
});

const cmsWebDefinition = defineExtension({
  manifest: projectExtensionManifest(cmsManifest, ['web']),
  web: createCmsWebExtension<PublicWebContext>({
    client: createCmsWebClient((path, init) => fetch(path, init)),
    resolvePresentation: (context) => context.presentation,
  }),
});

export const publicWebSystem = defineSystem({
  id: 'frame-reference-web',
  version: FRAME_VERSION,
  extensions: [frameWebDefinition, cmsWebDefinition, referenceSiteDefinition],
});

export const webRegistry = createWebRegistry<PublicWebContext>(publicWebSystem);

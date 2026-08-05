import '@lingcoo/frame-design-tokens/base.css';
import '@lingcoo/frame-ui/styles.css';

import { frameCoreManifest } from '@lingcoo/frame/manifest';
import { Button } from '@lingcoo/frame-ui/button';
import { createAdminRegistry } from '@lingcoo/frame-admin';
import { createWebRegistry } from '@lingcoo/frame-web';
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

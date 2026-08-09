import { frameCmsExtension } from '@lingcootech/frame/cms';
import { frameCoreExtension } from '@lingcootech/frame/extensions';
import { exampleExtension } from '@lingcootech/frame-example-extension';
import { defineSystem } from '@lingcootech/frame-extension-sdk';

export const consumerSystem = defineSystem({
  id: 'packed-consumer',
  version: '0.1.0',
  extensions: [frameCoreExtension, frameCmsExtension, exampleExtension],
});

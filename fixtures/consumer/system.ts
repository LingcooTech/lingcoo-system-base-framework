import { frameCoreExtension } from '@lingcoo/frame/extensions';
import { exampleExtension } from '@lingcoo/frame-example-extension';
import { defineSystem } from '@lingcoo/frame-extension-sdk';

export const consumerSystem = defineSystem({
  id: 'packed-consumer',
  version: '0.1.0',
  extensions: [frameCoreExtension, exampleExtension],
});

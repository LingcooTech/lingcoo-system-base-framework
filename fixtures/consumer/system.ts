import { frameCmsExtension } from '@lingcootech/frame/cms';
import type { ServerCapabilityRegistry } from '@lingcootech/frame/capabilities';
import type { SystemEnvironmentRegistry } from '@lingcootech/frame/environment';
import { frameKernelExtension } from '@lingcootech/frame/extensions';
import { SECURITY_PROVIDER_CAPABILITY, type SecurityProvider } from '@lingcootech/frame/security';
import { exampleExtension } from '@lingcootech/frame-example-extension';
import { defineSystem } from '@lingcootech/frame-extension-sdk';
import { frameIdentityExtension } from '@lingcootech/frame-identity';
import { frameAssetsExtension } from '@lingcootech/frame-assets';
import { frameJobsExtension } from '@lingcootech/frame-jobs';
import { frameNotificationsExtension } from '@lingcootech/frame-notifications';
import { framePresentationExtension } from '@lingcootech/frame-presentation';
import { frameIntegrationsExtension } from '@lingcootech/frame-integrations';

export const consumerSecurityProviderContract: SecurityProvider | undefined = undefined;

export function resolveConsumerSecurityProvider(
  capabilities: ServerCapabilityRegistry,
): SecurityProvider {
  return capabilities.require<SecurityProvider>(SECURITY_PROVIDER_CAPABILITY);
}

export function hasConsumerEnvironment(
  environment: SystemEnvironmentRegistry,
  extensionId: string,
): boolean {
  return environment.has(extensionId);
}

export const consumerSystem = defineSystem({
  id: 'packed-consumer',
  version: '0.1.0',
  extensions: [
    frameKernelExtension,
    frameIdentityExtension,
    frameIntegrationsExtension,
    frameJobsExtension,
    frameAssetsExtension,
    framePresentationExtension,
    frameNotificationsExtension,
    frameCmsExtension,
    exampleExtension,
  ],
});

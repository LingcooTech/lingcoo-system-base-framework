import { createCookieSessionSecurityProvider as createIdentitySecurityProvider } from '@lingcootech/frame-identity/provider';
import { LEGACY_IDENTITY_ENVIRONMENT_ID } from '@lingcootech/frame-identity/environment';

/** @deprecated Import from @lingcootech/frame-identity/provider. */
export function createCookieSessionSecurityProvider(
  environmentId: string = LEGACY_IDENTITY_ENVIRONMENT_ID,
) {
  return createIdentitySecurityProvider(environmentId);
}

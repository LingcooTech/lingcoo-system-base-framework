import type { WebRouteContext } from '@lingcootech/frame-web';
import { PublicAuthFlow, publicAuthModeFromRoute } from '@lingcootech/frame-web/account';
import { SystemPage } from '@lingcootech/frame-web/system-states';

import type { PublicWebContext } from './extensions';

export function AuthRoute({ context, params }: WebRouteContext<PublicWebContext>) {
  const mode = publicAuthModeFromRoute(params.mode);
  return mode ? (
    <PublicAuthFlow mode={mode} presentation={context.presentation} />
  ) : (
    <SystemPage kind="404" presentation={context.presentation} />
  );
}

import { WebRouteSlot, WebShell } from '@lingcootech/frame-web';
import { usePublicPresentation } from '@lingcootech/frame-web/presentation';
import { SystemPage } from '@lingcootech/frame-web/system-states';

import { webRegistry, type PublicWebContext } from './extensions';

export default function App() {
  const { presentation } = usePublicPresentation();
  return (
    <WebShell registry={webRegistry}>
      <WebRouteSlot<PublicWebContext>
        context={{ presentation }}
        notFound={<SystemPage kind="404" presentation={presentation} />}
        pathname={window.location.pathname}
        searchParams={new URLSearchParams(window.location.search)}
      />
    </WebShell>
  );
}

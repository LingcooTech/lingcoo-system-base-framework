import { WebRouteSlot, WebShell } from '@lingcoo/frame-web';
import { usePublicPresentation } from '@lingcoo/frame-web/presentation';
import { SystemPage } from '@lingcoo/frame-web/system-states';

import { webRegistry, type PublicWebContext } from './extensions';

function App() {
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

export default App;

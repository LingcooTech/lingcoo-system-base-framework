import { Shell } from './components/layout/Shell';
import { RouterProvider, useRouter } from './lib/router';
import { DashboardPage } from './pages/DashboardPage';
import { ModulesPage } from './pages/ModulesPage';
import { SettingsPage } from './pages/SettingsPage';

function RoutedApp() {
  const { pathname } = useRouter();
  const page = pathname.startsWith('/modules') ? (
    <ModulesPage />
  ) : pathname.startsWith('/settings') ? (
    <SettingsPage />
  ) : (
    <DashboardPage />
  );
  return <Shell>{page}</Shell>;
}

export function App() {
  return (
    <RouterProvider>
      <RoutedApp />
    </RouterProvider>
  );
}

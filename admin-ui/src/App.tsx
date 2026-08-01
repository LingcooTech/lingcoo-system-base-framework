import { Shell } from './components/layout/Shell';
import { AuthProvider, useAuth } from './lib/auth';
import { getSectionByPath } from './lib/foundation';
import { RouterProvider, useRouter } from './lib/router';
import { AccessPage } from './pages/AccessPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { ModulesPage } from './pages/ModulesPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { OperationsPage } from './pages/OperationsPage';
import { SettingsPage } from './pages/SettingsPage';

function RoutedApp() {
  const { account, hasPermission, loading, logout } = useAuth();
  const { pathname } = useRouter();
  if (loading) {
    return (
      <main className="auth-loading">
        <span className="lc-spinner lc-spinner--lg" aria-hidden />
        <p>正在验证会话…</p>
      </main>
    );
  }
  if (!account) return <LoginPage />;
  if (account.mustChangePassword) return <ChangePasswordPage />;
  if (!hasPermission('admin.access')) {
    return (
      <main className="password-screen">
        <section className="password-panel">
          <p className="eyebrow">Access denied</p>
          <h1>当前账号不能访问管理后台</h1>
          <p className="password-copy">该账号可以继续用于未来的公共用户侧或领域应用。</p>
          <button
            className="lc-button lc-button--secondary lc-button--lg"
            onClick={() => void logout()}
          >
            退出登录
          </button>
        </section>
      </main>
    );
  }
  const activeSection = getSectionByPath(pathname);
  if (!hasPermission(activeSection.permission)) {
    return (
      <main className="password-screen">
        <section className="password-panel">
          <p className="eyebrow">Permission required</p>
          <h1>当前账号没有页面权限</h1>
          <p className="password-copy">请联系系统所有者调整角色，或返回有权限的导航页面。</p>
          <a className="lc-button lc-button--secondary lc-button--lg" href="/admin/">
            返回系统概览
          </a>
        </section>
      </main>
    );
  }

  const page = pathname.startsWith('/access') ? (
    <AccessPage />
  ) : pathname.startsWith('/integrations') ? (
    <IntegrationsPage />
  ) : pathname.startsWith('/modules') ? (
    <ModulesPage />
  ) : pathname.startsWith('/operations') ? (
    <OperationsPage />
  ) : pathname.startsWith('/notifications') ? (
    <NotificationsPage />
  ) : pathname.startsWith('/settings') ? (
    <SettingsPage />
  ) : (
    <DashboardPage />
  );
  return <Shell>{page}</Shell>;
}

export function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <RoutedApp />
      </RouterProvider>
    </AuthProvider>
  );
}

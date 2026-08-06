import { AdminRouteSlot, AdminShell } from '@lingcoo/frame-admin';

import { Shell } from './components/layout/Shell';
import { AuthProvider, useAuth } from './lib/auth';
import { RouterProvider, useRouter } from './lib/router';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { LoginPage } from './pages/LoginPage';
import { adminRegistry, type AdminAppContext } from './extensions';

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
  const match = adminRegistry.matchRoute(pathname);
  if (match && !hasPermission(match.route.permission)) {
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

  return (
    <Shell>
      <AdminRouteSlot<AdminAppContext>
        context={{}}
        hasPermission={hasPermission}
        notFound={
          <section className="password-panel">
            <p className="eyebrow">Not found</p>
            <h1>页面不存在</h1>
            <a className="lc-button lc-button--secondary" href="/admin/">
              返回系统概览
            </a>
          </section>
        }
        pathname={pathname}
      />
    </Shell>
  );
}

export function App() {
  return (
    <AdminShell registry={adminRegistry}>
      <AuthProvider>
        <RouterProvider>
          <RoutedApp />
        </RouterProvider>
      </AuthProvider>
    </AdminShell>
  );
}

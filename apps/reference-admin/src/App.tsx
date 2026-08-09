import { AdminRouteSlot, AdminShell } from '@lingcootech/frame-admin';
import {
  AdminAuthProvider,
  AdminChangePasswordPage,
  AdminLoginPage,
  useAdminAuth,
  type AdminAuthClient,
} from '@lingcootech/frame-admin/auth';
import { AdminApplicationShell } from '@lingcootech/frame-admin/layout';
import { AdminRouterProvider, useAdminRouter } from '@lingcootech/frame-admin/router';
import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';
import {
  ApiError,
  changePassword,
  fetchCurrentAccount,
  fetchPresentation,
  fetchUnreadNotificationCount,
  login,
  logout,
  type AuthAccount,
} from '@lingcootech/frame-admin/defaults';
import { adminRegistry, type AdminAppContext } from './extensions';

const authClient: AdminAuthClient<AuthAccount> = {
  async getCurrentAccount() {
    try {
      return await fetchCurrentAccount();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null;
      throw error;
    }
  },
  login,
  logout,
  changePassword,
};

async function loadShellPresentation() {
  const presentation = await fetchPresentation();
  const logoId = presentation.squareLogoAssetId ?? presentation.fullLogoAssetId;
  return {
    displayName: presentation.displayName,
    logoUrl: logoId ? (presentation.assets[logoId]?.publicUrl ?? null) : null,
  };
}

function RoutedApp() {
  const { account, hasPermission, loading, logout: endSession } = useAdminAuth<AuthAccount>();
  const { pathname, searchParams } = useAdminRouter();
  if (loading) {
    return (
      <main className="auth-loading">
        <span className="lc-spinner lc-spinner--lg" aria-hidden />
        <p>正在验证会话…</p>
      </main>
    );
  }
  if (!account) return <AdminLoginPage brandName="Lingcoo Frame" />;
  if (account.mustChangePassword) return <AdminChangePasswordPage />;
  if (!hasPermission('admin.access')) {
    return (
      <main className="password-screen">
        <section className="password-panel">
          <p className="eyebrow">Access denied</p>
          <h1>当前账号不能访问管理后台</h1>
          <p className="password-copy">该账号可以继续用于未来的公共用户侧或领域应用。</p>
          <button
            className="lc-button lc-button--secondary lc-button--lg"
            onClick={() => void endSession()}
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
    <AdminApplicationShell<AdminAppContext>
      context={{}}
      defaultBrandName="Lingcoo Frame"
      frame={{
        name: 'Lingcoo Frame',
        version: FRAME_VERSION,
        systemInfoHref: '/system',
        systemInfoPermission: 'system.runtime.read',
      }}
      helpHref="/help"
      loadPresentation={loadShellPresentation}
      loadUnreadNotificationCount={fetchUnreadNotificationCount}
    >
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
        searchParams={searchParams}
      />
    </AdminApplicationShell>
  );
}

export function App() {
  return (
    <AdminShell registry={adminRegistry}>
      <AdminAuthProvider client={authClient}>
        <AdminRouterProvider>
          <RoutedApp />
        </AdminRouterProvider>
      </AdminAuthProvider>
    </AdminShell>
  );
}

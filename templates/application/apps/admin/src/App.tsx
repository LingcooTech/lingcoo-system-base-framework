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
import { FRAME_VERSION } from '@lingcootech/frame-extension-sdk';

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
  if (loading) return <main className="app-message">正在验证会话…</main>;
  if (!account) return <AdminLoginPage brandName="__DISPLAY_NAME__" />;
  if (account.mustChangePassword) return <AdminChangePasswordPage />;
  if (!hasPermission('admin.access')) {
    return (
      <main className="app-message">
        <h1>当前账号不能访问管理后台</h1>
        <button className="lc-button" onClick={() => void endSession()}>
          退出登录
        </button>
      </main>
    );
  }

  return (
    <AdminApplicationShell<AdminAppContext>
      context={{}}
      defaultBrandName="__DISPLAY_NAME__"
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
        notFound={<main className="app-message">页面不存在</main>}
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

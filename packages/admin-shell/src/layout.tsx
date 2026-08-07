import { Avatar, AvatarFallback, AvatarImage } from '@lingcoo/frame-ui/avatar';
import { Dialog, DialogContent, DialogHeader } from '@lingcoo/frame-ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@lingcoo/frame-ui/dropdown-menu';
import { Input } from '@lingcoo/frame-ui/input';
import { Tooltip, TooltipProvider } from '@lingcoo/frame-ui/tooltip';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Layers3,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';

import {
  useAdminRegistry,
  type AdminRegistry,
  type AdminSearchGroup,
  type RegisteredAdminNavigation,
} from './index.js';
import { useAdminAuth, type AdminAccount } from './auth.js';
import { AdminLink, useAdminRouter } from './router.js';

const COLLAPSE_STORAGE_KEY = 'lingcoo-frame-admin-sidebar-collapsed';

export interface AdminShellPresentation {
  displayName: string;
  logoUrl?: string | null;
}

export interface AdminFrameIdentity {
  name: string;
  version: string;
  systemInfoHref?: string;
  systemInfoPermission?: string;
}

export interface AdminApplicationShellProps<TContext> {
  children: ReactNode;
  context: TContext;
  defaultBrandName?: string;
  brandSubtitle?: string;
  loadPresentation?: () => Promise<AdminShellPresentation>;
  loadUnreadNotificationCount?: () => Promise<number>;
  accountHref?: string;
  accountSecurityHref?: string;
  helpHref?: string;
  notificationsHref?: string;
  settingsHref?: string;
  frame?: AdminFrameIdentity;
}

function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function groupNavigation<TContext>(navigation: readonly RegisteredAdminNavigation<TContext>[]) {
  return navigation.reduce<{ label: string; items: RegisteredAdminNavigation<TContext>[] }[]>(
    (groups, item) => {
      const existing = groups.find((group) => group.label === item.group);
      if (existing) existing.items.push(item);
      else groups.push({ label: item.group, items: [item] });
      return groups;
    },
    [],
  );
}

function getActiveNavigation<TContext>(
  pathname: string,
  registry: AdminRegistry<TContext>,
): RegisteredAdminNavigation<TContext> | undefined {
  const match = registry.matchRoute(pathname);
  return match
    ? registry.navigation.find((navigation) => navigation.route.id === match.route.id)
    : undefined;
}

function getInitials(displayName: string) {
  return (
    displayName
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'LC'
  );
}

function AccountMenu({
  account,
  accountHref,
  accountSecurityHref,
  canReadSettings,
  onLogout,
  settingsHref,
}: {
  account: AdminAccount;
  accountHref: string;
  accountSecurityHref: string;
  canReadSettings: boolean;
  onLogout(): void;
  settingsHref?: string;
}) {
  const roleNames = account.roles.map((role) => role.name).join('、') || '普通账号';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`${account.displayName}的账号菜单`}
          className="admin-account-trigger"
          type="button"
        >
          <Avatar>
            {account.avatarUrl ? <AvatarImage alt="" src={account.avatarUrl} /> : null}
            <AvatarFallback>{getInitials(account.displayName)}</AvatarFallback>
          </Avatar>
          <span className="admin-account-trigger__copy">
            <strong>{account.displayName}</strong>
            <small>{roleNames}</small>
          </span>
          <ChevronUp aria-hidden size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="admin-account-dropdown" side="bottom">
        <DropdownMenuLabel>
          <span className="admin-account-dropdown__name">{account.displayName}</span>
          <span className="admin-account-dropdown__email">{account.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <AdminLink href={accountHref}>
            <UserRound aria-hidden size={16} />
            个人中心
          </AdminLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <AdminLink href={accountSecurityHref}>
            <ShieldCheck aria-hidden size={16} />
            账号安全
          </AdminLink>
        </DropdownMenuItem>
        {canReadSettings && settingsHref ? (
          <DropdownMenuItem asChild>
            <AdminLink href={settingsHref}>
              <Settings2 aria-hidden size={16} />
              应用设置
            </AdminLink>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} tone="danger">
          <LogOut aria-hidden size={16} />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlobalSearch<TContext>({
  context,
  open,
  onOpenChange,
}: {
  context: TContext;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { navigate } = useAdminRouter();
  const { hasPermission } = useAdminAuth();
  const registry = useAdminRegistry<TContext>();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<readonly AdminSearchGroup[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (query.trim().length < 2) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setStatus('loading');
      const providers = registry.searchProviders.filter(
        (provider) => !provider.permission || hasPermission(provider.permission),
      );
      Promise.all(providers.map((provider) => provider.search({ context, query: query.trim() })))
        .then((result) => {
          if (active) {
            setGroups(result.flat());
            setStatus('ready');
          }
        })
        .catch(() => {
          if (active) setStatus('error');
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [context, hasPermission, query, registry]);

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) {
      setQuery('');
      setGroups([]);
      setStatus('idle');
    }
    onOpenChange(nextOpen);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="admin-global-search"
        header={<DialogHeader title="统一搜索" description="只搜索当前账号有权访问的资源。" />}
        size="lg"
      >
        <Input
          autoFocus
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < 2) {
              setGroups([]);
              setStatus('idle');
            }
          }}
          placeholder="输入至少两个字符开始搜索"
          prefix={<Search size={16} />}
          value={query}
        />
        <div className="admin-global-search__results">
          {groups.map((group) => (
            <section key={group.id}>
              <h3>{group.label}</h3>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.href);
                    changeOpen(false);
                  }}
                  type="button"
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.subtitle}</small>
                  </span>
                  <code>{item.kind}</code>
                </button>
              ))}
            </section>
          ))}
          {status === 'idle' ? <p>输入名称、代码或对象标识开始搜索。</p> : null}
          {status === 'loading' ? <p>正在搜索已注册资源…</p> : null}
          {status === 'ready' && groups.length === 0 ? <p>没有找到匹配资源。</p> : null}
          {status === 'error' ? <p className="error">搜索暂时不可用，请稍后重试。</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Sidebar<TContext>({
  brandName,
  brandSubtitle,
  collapsed,
  logoUrl,
  mobile,
  navigation,
  onCloseMobile,
  onToggleCollapsed,
  pathname,
}: {
  brandName: string;
  brandSubtitle: string;
  collapsed: boolean;
  logoUrl: string | null;
  mobile: boolean;
  navigation: readonly RegisteredAdminNavigation<TContext>[];
  onCloseMobile(): void;
  onToggleCollapsed(): void;
  pathname: string;
}) {
  const groups = groupNavigation(navigation);
  const [headerRevealSuppressed, setHeaderRevealSuppressed] = useState(false);
  function toggleCollapsed(event: MouseEvent<HTMLButtonElement>) {
    if (!collapsed && event.detail > 0) {
      setHeaderRevealSuppressed(true);
      event.currentTarget.blur();
    }
    onToggleCollapsed();
  }
  return (
    <aside className={collapsed ? 'admin-sidebar admin-sidebar--collapsed' : 'admin-sidebar'}>
      <div
        className={
          headerRevealSuppressed
            ? 'admin-sidebar__header admin-sidebar__header--reveal-suppressed'
            : 'admin-sidebar__header'
        }
        onPointerLeave={() => setHeaderRevealSuppressed(false)}
      >
        <div className="admin-brand">
          <span className="admin-brand-mark" aria-hidden>
            {logoUrl ? <img alt="" src={logoUrl} /> : <Layers3 size={18} />}
          </span>
          {!collapsed ? (
            <span className="admin-brand__copy">
              <strong>{brandName}</strong>
              <small>{brandSubtitle}</small>
            </span>
          ) : null}
        </div>
        {mobile ? (
          <button aria-label="关闭导航" onClick={onCloseMobile} type="button">
            <X size={17} />
          </button>
        ) : (
          <Tooltip content={collapsed ? '展开导航' : '收起导航'} side="right">
            <button
              aria-label={collapsed ? '展开导航' : '收起导航'}
              onClick={toggleCollapsed}
              type="button"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </Tooltip>
        )}
      </div>
      <nav aria-label="应用后台导航" className="admin-sidebar__navigation">
        {groups.map((group) => (
          <section className="admin-sidebar__group" key={group.label}>
            {!collapsed ? <p>{group.label}</p> : <span aria-hidden />}
            <div>
              {group.items.map((item) => {
                const Icon = item.icon ?? Layers3;
                const active =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                const link = (
                  <AdminLink
                    aria-current={active ? 'page' : undefined}
                    className={active ? 'admin-nav-item admin-nav-item--active' : 'admin-nav-item'}
                    href={item.href}
                    onNavigate={onCloseMobile}
                  >
                    <Icon aria-hidden size={17} />
                    {!collapsed ? <span>{item.label}</span> : null}
                  </AdminLink>
                );
                return collapsed ? (
                  <Tooltip content={item.label} key={item.id}>
                    {link}
                  </Tooltip>
                ) : (
                  <span className="admin-nav-item__wrap" key={item.id}>
                    {link}
                  </span>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}

export function AdminApplicationShell<TContext>({
  accountHref = '/account',
  accountSecurityHref = '/account#security',
  brandSubtitle = 'Administration',
  children,
  context,
  defaultBrandName = 'Application',
  frame,
  helpHref,
  loadPresentation,
  loadUnreadNotificationCount,
  notificationsHref = '/notifications',
  settingsHref = '/settings',
}: AdminApplicationShellProps<TContext>) {
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [presentation, setPresentation] = useState<AdminShellPresentation>({
    displayName: defaultBrandName,
    logoUrl: null,
  });
  const { account, hasPermission, logout } = useAdminAuth();
  const { pathname } = useAdminRouter();
  const registry = useAdminRegistry<TContext>();
  const visibleNavigation = useMemo(
    () => registry.navigation.filter((item) => hasPermission(item.route.permission)),
    [hasPermission, registry.navigation],
  );
  const activeNavigation = getActiveNavigation(pathname, registry);
  const activeRoute = registry.matchRoute(pathname)?.route;
  const canSearch = hasPermission('search.use');
  const canReadNotifications = hasPermission('notifications.read');
  const canOpenSettings = hasPermission('admin.access');
  const canReadPresentation = hasPermission('presentation.read');
  const canOpenSystemInfo = frame?.systemInfoHref
    ? !frame.systemInfoPermission || hasPermission(frame.systemInfoPermission)
    : false;

  useEffect(() => {
    if (!loadUnreadNotificationCount || !canReadNotifications) return;
    loadUnreadNotificationCount()
      .then(setUnreadNotifications)
      .catch(() => undefined);
  }, [canReadNotifications, loadUnreadNotificationCount, pathname]);

  useEffect(() => {
    if (!loadPresentation || !canReadPresentation) return;
    loadPresentation()
      .then(setPresentation)
      .catch(() => undefined);
  }, [canReadPresentation, loadPresentation]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (canSearch && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [canSearch]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  if (!account) return null;

  function toggleCollapsed() {
    setCollapsed((value) => {
      const nextValue = !value;
      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(nextValue));
      } catch {
        // Storage is optional; the current session can still collapse the sidebar.
      }
      return nextValue;
    });
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className={collapsed ? 'admin-app-shell admin-app-shell--collapsed' : 'admin-app-shell'}>
        <div
          className={
            mobileOpen ? 'admin-sidebar-slot admin-sidebar-slot--open' : 'admin-sidebar-slot'
          }
        >
          <Sidebar
            brandName={presentation.displayName}
            brandSubtitle={brandSubtitle}
            collapsed={collapsed && !mobileOpen}
            logoUrl={presentation.logoUrl ?? null}
            mobile={mobileOpen}
            navigation={visibleNavigation}
            onCloseMobile={() => setMobileOpen(false)}
            onToggleCollapsed={toggleCollapsed}
            pathname={pathname}
          />
        </div>
        {mobileOpen ? (
          <button
            aria-label="关闭导航"
            className="admin-mobile-scrim"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
        ) : null}
        <div className="admin-main-column">
          <header className="admin-topbar">
            <div className="admin-topbar__leading">
              <button
                aria-label="打开导航"
                className="admin-topbar__icon admin-mobile-menu"
                onClick={() => setMobileOpen(true)}
                type="button"
              >
                <Menu size={18} />
              </button>
              <div className="admin-breadcrumb">
                <span>{activeNavigation?.group ?? '应用'}</span>
                <strong>{activeNavigation?.label ?? activeRoute?.title ?? '管理后台'}</strong>
              </div>
            </div>
            <div className="admin-topbar__actions">
              {canSearch ? (
                <button
                  className="admin-command-button"
                  onClick={() => setSearchOpen(true)}
                  type="button"
                >
                  <Search size={15} />
                  <span>搜索</span>
                  <kbd>⌘ K</kbd>
                </button>
              ) : null}
              {helpHref ? (
                <AdminLink
                  aria-label="帮助"
                  className="admin-topbar__icon"
                  href={helpHref}
                  title="帮助"
                >
                  <CircleHelp size={17} />
                </AdminLink>
              ) : null}
              {canReadNotifications && notificationsHref ? (
                <AdminLink
                  aria-label={
                    unreadNotifications > 0 ? `通知，${unreadNotifications}条未读` : '通知'
                  }
                  className="admin-topbar__icon admin-notification-button"
                  href={notificationsHref}
                >
                  <Bell size={17} />
                  {unreadNotifications > 0 ? (
                    <span>{Math.min(unreadNotifications, 99)}</span>
                  ) : null}
                </AdminLink>
              ) : null}
              <AccountMenu
                account={account}
                accountHref={accountHref}
                accountSecurityHref={accountSecurityHref}
                canReadSettings={canOpenSettings}
                onLogout={() => void logout()}
                settingsHref={settingsHref}
              />
            </div>
          </header>
          <main className="admin-shell-content">{children}</main>
          {frame ? (
            <footer className="admin-frame-footer">
              {canOpenSystemInfo && frame.systemInfoHref ? (
                <AdminLink href={frame.systemInfoHref}>
                  本系统基于 {frame.name} 构建 · v{frame.version}
                </AdminLink>
              ) : (
                <span>
                  本系统基于 {frame.name} 构建 · v{frame.version}
                </span>
              )}
            </footer>
          ) : null}
        </div>
        {canSearch ? (
          <GlobalSearch context={context} open={searchOpen} onOpenChange={setSearchOpen} />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

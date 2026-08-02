import { Bell, ChevronLeft, ChevronRight, Layers3, LogOut, Menu, Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import { fetchUnreadNotificationCount } from '../../api/client';
import { useAuth } from '../../lib/auth';
import { getSectionByPath, sectionList } from '../../lib/foundation';
import { Link, useRouter } from '../../lib/router';
import { GlobalSearch } from './GlobalSearch';

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const { account, hasPermission, logout } = useAuth();
  const { pathname } = useRouter();
  const activeSection = getSectionByPath(pathname);
  const visibleSections = sectionList.filter((section) => hasPermission(section.permission));
  const initials =
    account?.displayName
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'LC';

  useEffect(() => {
    fetchUnreadNotificationCount()
      .then(setUnreadNotifications)
      .catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  return (
    <div className={collapsed ? 'app-shell shell-collapsed' : 'app-shell'}>
      <div className={mobileOpen ? 'sidebar-slot mobile-open' : 'sidebar-slot'}>
        <aside className={collapsed ? 'sidebar sidebar-collapsed' : 'sidebar'}>
          <div className="brand">
            <span className="brand-mark">
              <Layers3 size={18} />
            </span>
            {!collapsed ? (
              <span>
                <strong>Lingcoo Base</strong>
                <small>Framework Console</small>
              </span>
            ) : null}
          </div>
          <nav aria-label="基础框架后台导航">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const active =
                section.href === '/' ? pathname === '/' : pathname.startsWith(section.href);
              return (
                <Link
                  className={active ? 'nav-item nav-item-active' : 'nav-item'}
                  href={section.href}
                  key={section.id}
                  title={collapsed ? section.navLabel : undefined}
                >
                  <Icon size={17} />
                  {!collapsed ? <span>{section.navLabel}</span> : null}
                </Link>
              );
            })}
          </nav>
          <button
            className="collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed ? '收起导航' : null}
          </button>
        </aside>
      </div>
      {mobileOpen ? (
        <button
          className="mobile-scrim"
          aria-label="关闭导航"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <div className="main-column">
        <header className="topbar">
          <button
            aria-label="切换导航"
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen((value) => !value)}
            type="button"
          >
            <Menu size={18} />
          </button>
          <div>
            <span>{activeSection.group}</span>
            <strong>{activeSection.navLabel}</strong>
          </div>
          <button
            className="command-button"
            disabled={!hasPermission('search.use')}
            onClick={() => setSearchOpen(true)}
            type="button"
          >
            <Search size={15} />
            <span>搜索页面和资源</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="account-actions">
            <Link
              className="icon-button notification-button"
              href="/notifications"
              title="通知中心"
            >
              <Bell size={17} />
              {unreadNotifications > 0 ? <span>{Math.min(unreadNotifications, 99)}</span> : null}
            </Link>
            <span className="account-copy">
              <strong>{account?.displayName}</strong>
              <small>{account?.roles.map((role) => role.name).join('、')}</small>
            </span>
            <span className="avatar">{initials}</span>
            <button
              aria-label="退出登录"
              className="logout-button"
              onClick={() => void logout()}
              title="退出登录"
              type="button"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
      {hasPermission('search.use') ? (
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      ) : null}
    </div>
  );
}

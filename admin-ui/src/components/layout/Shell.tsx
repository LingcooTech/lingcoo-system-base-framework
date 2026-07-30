import { ChevronLeft, ChevronRight, Layers3, Menu, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { getSectionByPath, sectionList } from '../../lib/foundation';
import { Link, useRouter } from '../../lib/router';

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useRouter();
  const activeSection = getSectionByPath(pathname);

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
            {sectionList.map((section) => {
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
          <button className="command-button" type="button">
            <Search size={15} />
            <span>搜索页面和资源</span>
            <kbd>⌘ K</kbd>
          </button>
          <span className="avatar">LC</span>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}

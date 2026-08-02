import { Tooltip } from '@lingcoo/frame-ui/tooltip';
import { ChevronLeft, ChevronRight, Layers3, X } from 'lucide-react';

import type { AuthAccount } from '../../api/client';
import type { SectionMeta } from '../../lib/foundation';
import { Link } from '../../lib/router';
import { AccountMenu } from './AccountMenu';

function groupSections(sections: SectionMeta[]) {
  return sections.reduce<{ label: string; sections: SectionMeta[] }[]>((groups, section) => {
    const existing = groups.find((group) => group.label === section.group);
    if (existing) existing.sections.push(section);
    else groups.push({ label: section.group, sections: [section] });
    return groups;
  }, []);
}

export function Sidebar({
  account,
  brandName,
  brandLogoUrl,
  canReadNotifications,
  canReadSettings,
  collapsed,
  mobile,
  pathname,
  sections,
  onCloseMobile,
  onLogout,
  onToggleCollapsed,
}: {
  account: AuthAccount;
  brandName: string;
  brandLogoUrl: string | null;
  canReadNotifications: boolean;
  canReadSettings: boolean;
  collapsed: boolean;
  mobile: boolean;
  pathname: string;
  sections: SectionMeta[];
  onCloseMobile(): void;
  onLogout(): void;
  onToggleCollapsed(): void;
}) {
  const groups = groupSections(sections);

  return (
    <aside className={collapsed ? 'sidebar sidebar-collapsed' : 'sidebar'}>
      <div className="sidebar-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            {brandLogoUrl ? <img alt="" src={brandLogoUrl} /> : <Layers3 size={18} />}
          </span>
          {!collapsed ? (
            <span className="brand-copy">
              <strong>{brandName}</strong>
              <small>Framework Console</small>
            </span>
          ) : null}
        </div>
        {mobile ? (
          <button
            aria-label="关闭导航"
            className="sidebar-header-button"
            onClick={onCloseMobile}
            type="button"
          >
            <X size={17} />
          </button>
        ) : (
          <Tooltip content={collapsed ? '展开导航' : '收起导航'} side="right">
            <button
              aria-label={collapsed ? '展开导航' : '收起导航'}
              className="sidebar-header-button"
              onClick={onToggleCollapsed}
              type="button"
            >
              {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </Tooltip>
        )}
      </div>

      <nav aria-label="基础框架后台导航" className="sidebar-navigation">
        {groups.map((group) => (
          <section className="sidebar-nav-group" key={group.label}>
            {!collapsed ? <p>{group.label}</p> : <span aria-hidden className="nav-group-divider" />}
            <div>
              {group.sections.map((section) => {
                const Icon = section.icon;
                const active =
                  section.href === '/' ? pathname === '/' : pathname.startsWith(section.href);
                const item = (
                  <Link
                    aria-current={active ? 'page' : undefined}
                    className={active ? 'nav-item nav-item-active' : 'nav-item'}
                    href={section.href}
                    onNavigate={onCloseMobile}
                  >
                    <Icon aria-hidden size={17} />
                    {!collapsed ? <span>{section.navLabel}</span> : null}
                  </Link>
                );
                return collapsed ? (
                  <Tooltip content={section.navLabel} key={section.id}>
                    {item}
                  </Tooltip>
                ) : (
                  <span className="nav-item-wrap" key={section.id}>
                    {item}
                  </span>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="sidebar-footer">
        <AccountMenu
          account={account}
          canReadNotifications={canReadNotifications}
          canReadSettings={canReadSettings}
          collapsed={collapsed}
          onLogout={onLogout}
          onNavigate={onCloseMobile}
        />
      </div>
    </aside>
  );
}

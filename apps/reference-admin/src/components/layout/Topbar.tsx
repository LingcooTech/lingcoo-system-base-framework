import { Bell, CircleHelp, Menu, Search } from 'lucide-react';

import type { SectionMeta } from '../../lib/foundation';
import { Link } from '../../lib/router';

export function Topbar({
  activeSection,
  canSearch,
  canReadNotifications,
  unreadNotifications,
  onOpenMobile,
  onOpenSearch,
}: {
  activeSection: SectionMeta;
  canSearch: boolean;
  canReadNotifications: boolean;
  unreadNotifications: number;
  onOpenMobile(): void;
  onOpenSearch(): void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-leading">
        <button
          aria-label="打开导航"
          className="topbar-icon mobile-menu"
          onClick={onOpenMobile}
          type="button"
        >
          <Menu size={18} />
        </button>
        <div className="breadcrumb">
          <span>{activeSection.group}</span>
          <strong>{activeSection.navLabel}</strong>
        </div>
      </div>
      <div className="topbar-actions">
        {canSearch ? (
          <button className="command-button" onClick={onOpenSearch} type="button">
            <Search size={15} />
            <span>搜索页面和资源</span>
            <kbd>⌘ K</kbd>
          </button>
        ) : null}
        <Link aria-label="框架帮助" className="topbar-icon" href="/help" title="框架帮助">
          <CircleHelp size={17} />
        </Link>
        {canReadNotifications ? (
          <Link
            aria-label={
              unreadNotifications > 0 ? `通知中心，${unreadNotifications}条未读` : '通知中心'
            }
            className="topbar-icon notification-button"
            href="/notifications"
          >
            <Bell size={17} />
            {unreadNotifications > 0 ? <span>{Math.min(unreadNotifications, 99)}</span> : null}
          </Link>
        ) : null}
      </div>
    </header>
  );
}

import { TooltipProvider } from '@lingcoo/frame-ui/tooltip';
import { useEffect, useState, type ReactNode } from 'react';

import { fetchPresentation, fetchUnreadNotificationCount } from '../../api/client';
import { useAuth } from '../../lib/auth';
import { getSectionByPath, sectionList } from '../../lib/foundation';
import { useRouter } from '../../lib/router';
import { GlobalSearch } from './GlobalSearch';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const COLLAPSE_STORAGE_KEY = 'lingcoo-frame-admin-sidebar-collapsed';

function readCollapsedPreference() {
  try {
    return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function Shell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [brandName, setBrandName] = useState('Lingcoo Base');
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const { account, hasPermission, logout } = useAuth();
  const { pathname } = useRouter();
  const activeSection = getSectionByPath(pathname);
  const visibleSections = sectionList.filter(
    (section) => section.id !== 'account' && hasPermission(section.permission),
  );
  const canSearch = hasPermission('search.use');
  const canReadNotifications = hasPermission('notifications.read');
  const canReadSettings = hasPermission('system.settings.read');
  const canReadPresentation = hasPermission('presentation.read');

  useEffect(() => {
    if (!canReadNotifications) return;
    fetchUnreadNotificationCount()
      .then(setUnreadNotifications)
      .catch(() => undefined);
  }, [canReadNotifications, pathname]);

  useEffect(() => {
    if (!canReadPresentation) return;
    fetchPresentation()
      .then((presentation) => {
        setBrandName(presentation.displayName);
        const logoId = presentation.squareLogoAssetId ?? presentation.fullLogoAssetId;
        setBrandLogoUrl(logoId ? (presentation.assets[logoId]?.publicUrl ?? null) : null);
      })
      .catch(() => undefined);
  }, [canReadPresentation]);

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
        // The UI remains functional when storage is unavailable.
      }
      return nextValue;
    });
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className={collapsed ? 'app-shell shell-collapsed' : 'app-shell'}>
        <div className={mobileOpen ? 'sidebar-slot mobile-open' : 'sidebar-slot'}>
          <Sidebar
            account={account}
            brandName={brandName}
            brandLogoUrl={brandLogoUrl}
            canReadNotifications={canReadNotifications}
            canReadSettings={canReadSettings}
            collapsed={collapsed && !mobileOpen}
            mobile={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
            onLogout={() => void logout()}
            onToggleCollapsed={toggleCollapsed}
            pathname={pathname}
            sections={visibleSections}
          />
        </div>
        {mobileOpen ? (
          <button
            aria-label="关闭导航"
            className="mobile-scrim"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
        ) : null}
        <div className="main-column">
          <Topbar
            activeSection={activeSection}
            canReadNotifications={canReadNotifications}
            canSearch={canSearch}
            onOpenMobile={() => setMobileOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            unreadNotifications={unreadNotifications}
          />
          <main>{children}</main>
        </div>
        {canSearch ? <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} /> : null}
      </div>
    </TooltipProvider>
  );
}

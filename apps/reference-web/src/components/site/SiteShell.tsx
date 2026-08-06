import { Button } from '@lingcoo/frame-ui/button';
import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from '@lingcoo/frame-ui/drawer';
import { ExternalLink, Menu } from 'lucide-react';
import { type ReactNode } from 'react';

import { Container } from './Layout';

interface NavigationItem {
  label: string;
  href: string;
}

export interface PublicPresentation {
  displayName: string;
  shortName: string | null;
  slogan: string | null;
  fullLogoAssetId: string | null;
  squareLogoAssetId: string | null;
  darkLogoAssetId: string | null;
  faviconAssetId: string | null;
  socialImageAssetId: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactAddress: string | null;
  publicUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  headerNavigation: NavigationItem[];
  footerLinks: NavigationItem[];
  footerCopyright: string | null;
  filingInfo: string | null;
  assets: Record<string, { publicUrl: string | null }>;
}

const fallbackNavigation: NavigationItem[] = [
  { label: '基础架构', href: '#architecture' },
  { label: '运行状态', href: '/health' },
];

function navigationHref(href: string): string {
  if (href.startsWith('#') && typeof window !== 'undefined' && window.location.pathname !== '/')
    return `/${href}`;
  return href;
}

function isCurrentNavigation(href: string): boolean {
  if (typeof window === 'undefined' || href.startsWith('#')) return false;
  const path = href.split(/[?#]/, 1)[0] || '/';
  return path === '/'
    ? window.location.pathname === '/'
    : window.location.pathname.startsWith(path);
}

function logoUrl(presentation: PublicPresentation | null, tone: 'dark' | 'light') {
  if (!presentation) return null;
  const id =
    (tone === 'dark' ? presentation.darkLogoAssetId : presentation.fullLogoAssetId) ??
    presentation.squareLogoAssetId ??
    presentation.fullLogoAssetId;
  return id ? presentation.assets[id]?.publicUrl : null;
}

export function SiteBrand({
  presentation,
  tone = 'dark',
}: {
  presentation: PublicPresentation | null;
  tone?: 'dark' | 'light';
}) {
  const displayName = presentation?.displayName ?? 'Lingcoo Frame';
  const imageUrl = logoUrl(presentation, tone);
  return (
    <a className="site-brand" href="/" aria-label={`${displayName} 首页`}>
      <span className="site-brand__mark">
        {imageUrl ? (
          <img alt="" src={imageUrl} />
        ) : (
          (presentation?.shortName?.slice(0, 1) ?? displayName.slice(0, 1) ?? 'F')
        )}
      </span>
      <span className="site-brand__name">
        <strong>{displayName}</strong>
        <small>{presentation?.slogan ?? 'System Framework'}</small>
      </span>
    </a>
  );
}

export function MobileNavigation({
  navigation,
  presentation,
}: {
  navigation: NavigationItem[];
  presentation: PublicPresentation | null;
}) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button aria-label="打开站点导航" className="site-mobile-trigger" type="button">
          <Menu size={19} />
        </button>
      </DrawerTrigger>
      <DrawerContent
        className="site-mobile-drawer"
        header={<DrawerHeader description="站点导航与公共入口" title="导航" />}
        side="right"
      >
        <SiteBrand presentation={presentation} tone="light" />
        <nav aria-label="移动端主要导航" className="site-mobile-nav">
          {navigation.map((item) => (
            <a
              aria-current={isCurrentNavigation(item.href) ? 'page' : undefined}
              href={navigationHref(item.href)}
              key={`${item.label}-${item.href}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Button asChild block trailingIcon={<ExternalLink size={14} />}>
          <a href="/admin/">进入管理后台</a>
        </Button>
      </DrawerContent>
    </Drawer>
  );
}

export function SiteHeader({
  overlay = false,
  presentation,
  tone = 'light',
}: {
  overlay?: boolean;
  presentation: PublicPresentation | null;
  tone?: 'dark' | 'light';
}) {
  const navigation = presentation?.headerNavigation.length
    ? presentation.headerNavigation
    : fallbackNavigation;
  return (
    <header
      className={`public-site-header public-site-header--${tone}${overlay ? ' public-site-header--overlay' : ''}`}
    >
      <Container className="public-site-header__inner">
        <SiteBrand presentation={presentation} tone={tone} />
        <nav aria-label="主要导航" className="site-desktop-nav">
          {navigation.map((item) => (
            <a
              aria-current={isCurrentNavigation(item.href) ? 'page' : undefined}
              href={navigationHref(item.href)}
              key={`${item.label}-${item.href}`}
            >
              {item.label}
            </a>
          ))}
          <a className="site-admin-link" href="/admin/">
            管理后台
            <ExternalLink size={14} />
          </a>
        </nav>
        <MobileNavigation navigation={navigation} presentation={presentation} />
      </Container>
    </header>
  );
}

export function SiteFooter({ presentation }: { presentation: PublicPresentation | null }) {
  const footerLinks = presentation?.footerLinks ?? [];
  const hasContact = Boolean(
    presentation?.contactEmail || presentation?.contactPhone || presentation?.contactAddress,
  );
  return (
    <footer className="public-site-footer">
      <Container>
        <div className="public-site-footer__main">
          <div>
            <SiteBrand presentation={presentation} />
            <p>{presentation?.slogan ?? 'Foundation first. Domain follows.'}</p>
          </div>
          {footerLinks.length ? (
            <nav aria-label="页脚导航">
              {footerLinks.map((item) => (
                <a href={navigationHref(item.href)} key={`${item.label}-${item.href}`}>
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
          {hasContact ? (
            <address>
              {presentation?.contactEmail ? (
                <a href={`mailto:${presentation.contactEmail}`}>{presentation.contactEmail}</a>
              ) : null}
              {presentation?.contactPhone ? (
                <a href={`tel:${presentation.contactPhone}`}>{presentation.contactPhone}</a>
              ) : null}
              {presentation?.contactAddress ? <span>{presentation.contactAddress}</span> : null}
            </address>
          ) : null}
        </div>
        <div className="public-site-footer__legal">
          <span>
            {presentation?.footerCopyright ??
              `© ${new Date().getFullYear()} ${presentation?.displayName ?? 'Lingcoo Frame'}`}
          </span>
          {presentation?.filingInfo ? <span>{presentation.filingInfo}</span> : null}
        </div>
      </Container>
    </footer>
  );
}

export function SiteShell({
  children,
  headerOverlay = false,
  headerTone = 'light',
  presentation,
}: {
  children: ReactNode;
  headerOverlay?: boolean;
  headerTone?: 'dark' | 'light';
  presentation: PublicPresentation | null;
}) {
  return (
    <div className={`public-site-shell public-site-shell--${headerTone}`}>
      <a className="site-skip-link" href="#main-content">
        跳至主要内容
      </a>
      <SiteHeader overlay={headerOverlay} presentation={presentation} tone={headerTone} />
      <main id="main-content">{children}</main>
      <SiteFooter presentation={presentation} />
    </div>
  );
}

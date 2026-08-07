import { useEffect, useState } from 'react';

export interface PublicNavigationItem {
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
  headerNavigation: readonly PublicNavigationItem[];
  footerLinks: readonly PublicNavigationItem[];
  footerCopyright: string | null;
  filingInfo: string | null;
  assets: Readonly<Record<string, { publicUrl: string | null }>>;
}

export interface PublicPresentationState {
  presentation: PublicPresentation | null;
  status: 'loading' | 'ready' | 'unavailable';
}

export function applyPublicPresentation(presentation: PublicPresentation): void {
  document.documentElement.style.setProperty('--site-primary', presentation.primaryColor);
  document.documentElement.style.setProperty('--site-secondary', presentation.secondaryColor);
  document.documentElement.style.setProperty('--site-accent', presentation.accentColor);
  const faviconUrl = presentation.faviconAssetId
    ? presentation.assets[presentation.faviconAssetId]?.publicUrl
    : null;
  if (!faviconUrl) return;
  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.rel = 'icon';
    document.head.append(favicon);
  }
  favicon.href = faviconUrl;
}

export function usePublicPresentation(
  endpoint = '/api/public/presentation',
): PublicPresentationState {
  const [state, setState] = useState<PublicPresentationState>({
    presentation: null,
    status: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('failed'))))
      .then(({ presentation }: { presentation: PublicPresentation }) => {
        applyPublicPresentation(presentation);
        setState({ presentation, status: 'ready' });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ presentation: null, status: 'unavailable' });
        }
      });
    return () => controller.abort();
  }, [endpoint]);

  return state;
}

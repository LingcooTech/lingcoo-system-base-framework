import { useEffect } from 'react';

import type { PublicPresentation } from './presentation.js';

export type StructuredData = Record<string, unknown>;

export function absoluteUrl(value: string, baseUrl: string) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

export function breadcrumbStructuredData(
  baseUrl: string,
  items: readonly { label: string; href?: string }[],
): StructuredData {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href, baseUrl) } : {}),
    })),
  };
}

const noStructuredData: StructuredData[] = [];

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.append(element);
  }
  Object.entries(attributes).forEach(([key, value]) => element?.setAttribute(key, value));
}

function upsertLink(rel: string, href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.append(element);
  }
  element.href = href;
}

function removeMeta(selector: string) {
  document.head.querySelector(selector)?.remove();
}

export function SeoHead({
  canonicalPath,
  description,
  image,
  noIndex = false,
  presentation,
  structuredData = noStructuredData,
  title,
  type = 'website',
}: {
  canonicalPath?: string;
  description?: string | null;
  image?: string | null;
  noIndex?: boolean;
  presentation: PublicPresentation | null;
  structuredData?: StructuredData | StructuredData[];
  title?: string | null;
  type?: 'article' | 'website';
}) {
  useEffect(() => {
    const siteName = presentation?.displayName ?? 'Lingcoo Frame';
    const resolvedTitle = title || presentation?.seoTitle || siteName;
    const resolvedDescription =
      description || presentation?.seoDescription || '用于构建行业与领域系统的共享基础架构。';
    const baseUrl = presentation?.publicUrl || window.location.origin;
    const canonical = absoluteUrl(canonicalPath || window.location.pathname, baseUrl);
    const defaultImageId = presentation?.socialImageAssetId;
    const resolvedImage =
      image || (defaultImageId ? presentation?.assets[defaultImageId]?.publicUrl : null);

    document.title = resolvedTitle;
    upsertMeta('meta[name="description"]', { name: 'description', content: resolvedDescription });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noIndex ? 'noindex, nofollow' : 'index, follow',
    });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: resolvedTitle });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: resolvedDescription,
    });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: siteName });
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: resolvedImage ? 'summary_large_image' : 'summary',
    });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: resolvedTitle });
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: resolvedDescription,
    });
    if (resolvedImage) {
      const absoluteImage = absoluteUrl(resolvedImage, baseUrl);
      upsertMeta('meta[property="og:image"]', { property: 'og:image', content: absoluteImage });
      upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: absoluteImage });
    } else {
      removeMeta('meta[property="og:image"]');
      removeMeta('meta[name="twitter:image"]');
    }
    upsertLink('canonical', canonical);

    const values = Array.isArray(structuredData) ? structuredData : [structuredData];
    document.head
      .querySelectorAll('script[data-public-structured-data]')
      .forEach((node) => node.remove());
    values.forEach((value) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.dataset.publicStructuredData = 'true';
      script.text = JSON.stringify(value).replaceAll('<', '\\u003c');
      document.head.append(script);
    });
  }, [canonicalPath, description, image, noIndex, presentation, structuredData, title, type]);

  return null;
}

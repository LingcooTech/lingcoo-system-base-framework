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
  items: { label: string; href?: string }[],
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

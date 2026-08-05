export interface PublicRoute {
  path: string;
  updatedAt?: Date | null;
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function absoluteUrl(baseUrl: string, path: string) {
  return new URL(path, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}

export function buildSitemap(baseUrl: string, routes: PublicRoute[]) {
  const entries = [{ path: '/', updatedAt: null }, ...routes.filter((route) => route.path !== '/')];
  const urls = entries
    .map(
      ({ path, updatedAt }) =>
        `  <url>\n    <loc>${escapeXml(absoluteUrl(baseUrl, path))}</loc>${
          updatedAt ? `\n    <lastmod>${updatedAt.toISOString()}</lastmod>` : ''
        }\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function buildRobots(baseUrl: string) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Disallow: /api/',
    'Disallow: /auth/',
    'Disallow: /preview/',
    `Sitemap: ${absoluteUrl(baseUrl, '/sitemap.xml')}`,
    '',
  ].join('\n');
}

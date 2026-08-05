export interface PublicSiteRoute {
  path: string;
  updatedAt?: Date | null;
}

export interface PublicSiteRedirect {
  targetPath: string;
  statusCode: number;
}

export class PublicSiteRegistry {
  private readonly redirectResolvers = new Map<
    string,
    (path: string) => Promise<PublicSiteRedirect | null>
  >();
  private readonly sitemapCollectors = new Map<string, () => Promise<readonly PublicSiteRoute[]>>();

  registerRedirectResolver(
    id: string,
    resolver: (path: string) => Promise<PublicSiteRedirect | null>,
  ): void {
    if (this.redirectResolvers.has(id))
      throw new Error(`Redirect resolver already registered: ${id}`);
    this.redirectResolvers.set(id, resolver);
  }

  registerSitemapCollector(id: string, collector: () => Promise<readonly PublicSiteRoute[]>): void {
    if (this.sitemapCollectors.has(id))
      throw new Error(`Sitemap collector already registered: ${id}`);
    this.sitemapCollectors.set(id, collector);
  }

  async resolveRedirect(path: string): Promise<PublicSiteRedirect | null> {
    for (const resolver of this.redirectResolvers.values()) {
      const redirect = await resolver(path);
      if (redirect) return redirect;
    }
    return null;
  }

  async collectSitemapRoutes(): Promise<PublicSiteRoute[]> {
    const routes = (
      await Promise.all([...this.sitemapCollectors.values()].map((collect) => collect()))
    ).flat();
    const byPath = new Map<string, PublicSiteRoute>();
    for (const route of routes) {
      if (!route.path.startsWith('/') || route.path.includes('?') || route.path.includes('#')) {
        throw new Error(`Invalid public Sitemap path: ${route.path}`);
      }
      const current = byPath.get(route.path);
      if (!current || (route.updatedAt?.getTime() ?? 0) > (current.updatedAt?.getTime() ?? 0)) {
        byPath.set(route.path, route);
      }
    }
    return [...byPath.values()].sort((left, right) => left.path.localeCompare(right.path));
  }
}

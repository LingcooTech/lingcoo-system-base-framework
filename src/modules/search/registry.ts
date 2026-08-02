import type { Database } from '../../db/client.js';
import type { PermissionCode } from '../../lib/rbac.js';

export interface SearchResult {
  id: string;
  source: string;
  sourceLabel: string;
  kind: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchProvider {
  code: string;
  label: string;
  permission: PermissionCode;
  search(db: Database, query: string, limit: number): Promise<SearchResult[]>;
}

export class SearchProviderRegistry {
  private readonly providers = new Map<string, SearchProvider>();

  register(provider: SearchProvider): void {
    if (this.providers.has(provider.code)) {
      throw new Error(`Search provider already registered: ${provider.code}`);
    }
    this.providers.set(provider.code, provider);
  }

  list(): SearchProvider[] {
    return [...this.providers.values()];
  }
}

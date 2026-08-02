import type { Database } from '../../db/client.js';
import { hasPermission } from '../../lib/rbac.js';
import type { SearchProviderRegistry } from './registry.js';

export class SearchService {
  constructor(
    private readonly db: Database,
    private readonly registry: SearchProviderRegistry,
  ) {}

  sources(roleCodes: string[], permissions: string[]) {
    return this.registry
      .list()
      .filter((provider) => hasPermission(roleCodes, permissions, provider.permission))
      .map((provider) => ({ code: provider.code, label: provider.label }));
  }

  async search(query: string, limit: number, roleCodes: string[], permissions: string[]) {
    const providers = this.registry
      .list()
      .filter((provider) => hasPermission(roleCodes, permissions, provider.permission));
    const groups = await Promise.all(
      providers.map(async (provider) => {
        try {
          return {
            source: provider.code,
            label: provider.label,
            items: await provider.search(this.db, query, limit),
          };
        } catch {
          return { source: provider.code, label: provider.label, items: [] };
        }
      }),
    );
    return groups.filter((group) => group.items.length > 0);
  }
}

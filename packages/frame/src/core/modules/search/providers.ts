import { ilike, or } from 'drizzle-orm';

import { metadataDictionaries, taxonomies } from '@lingcootech/frame-database/schema';
import type { IdentityAccountDirectoryPort } from '@lingcootech/frame-identity';
import type { IntegrationConnectionsPort } from '@lingcootech/frame-integrations';
import type { SearchProvider } from './registry.js';

export function createBaseSearchProviders(
  accountDirectory: IdentityAccountDirectoryPort,
  integrationConnectionPort: IntegrationConnectionsPort,
): SearchProvider[] {
  return [
    {
      code: 'accounts',
      label: '系统账号',
      permission: 'iam.accounts.read',
      async search(_db, query, limit) {
        const rows = await accountDirectory.search(query, limit);
        return rows.map((row) => ({
          id: row.id,
          source: 'accounts',
          sourceLabel: '系统账号',
          kind: 'account',
          title: row.displayName,
          subtitle: `${row.email} · ${row.status === 'active' ? '启用' : '停用'}`,
          href: '/access',
        }));
      },
    },
    {
      code: 'integrations',
      label: '服务连接',
      permission: 'integrations.read',
      async search(_db, query, limit) {
        const rows = await integrationConnectionPort.search(query, limit);
        return rows.map((row) => ({
          id: row.id,
          source: 'integrations',
          sourceLabel: '服务连接',
          kind: row.providerCode,
          title: row.name,
          subtitle: `${row.providerCode} · ${row.enabled ? '已启用' : '未启用'}`,
          href: '/integrations',
        }));
      },
    },
    {
      code: 'dictionaries',
      label: '数据字典',
      permission: 'metadata.read',
      async search(db, query, limit) {
        const pattern = `%${query}%`;
        const rows = await db
          .select({
            id: metadataDictionaries.id,
            code: metadataDictionaries.code,
            name: metadataDictionaries.name,
            description: metadataDictionaries.description,
          })
          .from(metadataDictionaries)
          .where(
            or(
              ilike(metadataDictionaries.code, pattern),
              ilike(metadataDictionaries.name, pattern),
              ilike(metadataDictionaries.description, pattern),
            ),
          )
          .limit(limit);
        return rows.map((row) => ({
          id: row.id,
          source: 'dictionaries',
          sourceLabel: '数据字典',
          kind: 'dictionary',
          title: row.name,
          subtitle: row.description || row.code,
          href: '/metadata',
        }));
      },
    },
    {
      code: 'taxonomies',
      label: '分类与标签',
      permission: 'metadata.read',
      async search(db, query, limit) {
        const pattern = `%${query}%`;
        const rows = await db
          .select({
            id: taxonomies.id,
            code: taxonomies.code,
            name: taxonomies.name,
            kind: taxonomies.kind,
          })
          .from(taxonomies)
          .where(
            or(
              ilike(taxonomies.code, pattern),
              ilike(taxonomies.name, pattern),
              ilike(taxonomies.description, pattern),
            ),
          )
          .limit(limit);
        return rows.map((row) => ({
          id: row.id,
          source: 'taxonomies',
          sourceLabel: '分类与标签',
          kind: row.kind,
          title: row.name,
          subtitle: row.code,
          href: '/metadata',
        }));
      },
    },
  ];
}

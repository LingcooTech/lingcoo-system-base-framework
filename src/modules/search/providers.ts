import { ilike, or } from 'drizzle-orm';

import {
  accounts,
  cmsContentEntries,
  integrationConnections,
  metadataDictionaries,
  storageAssets,
  taxonomies,
} from '../../db/schema.js';
import type { SearchProvider } from './registry.js';

export const baseSearchProviders: SearchProvider[] = [
  {
    code: 'accounts',
    label: '系统账号',
    permission: 'iam.accounts.read',
    async search(db, query, limit) {
      const pattern = `%${query}%`;
      const rows = await db
        .select({
          id: accounts.id,
          email: accounts.email,
          displayName: accounts.displayName,
          status: accounts.status,
        })
        .from(accounts)
        .where(or(ilike(accounts.email, pattern), ilike(accounts.displayName, pattern)))
        .limit(limit);
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
    code: 'cms',
    label: '内容中心',
    permission: 'cms.read',
    async search(db, query, limit) {
      const pattern = `%${query}%`;
      const rows = await db
        .select({
          id: cmsContentEntries.id,
          title: cmsContentEntries.title,
          slug: cmsContentEntries.slug,
          type: cmsContentEntries.type,
          status: cmsContentEntries.status,
        })
        .from(cmsContentEntries)
        .where(or(ilike(cmsContentEntries.title, pattern), ilike(cmsContentEntries.slug, pattern)))
        .limit(limit);
      return rows.map((row) => ({
        id: row.id,
        source: 'cms',
        sourceLabel: '内容中心',
        kind: row.type,
        title: row.title,
        subtitle: `${row.slug} · ${row.status}`,
        href: `/cms/${row.id}`,
      }));
    },
  },
  {
    code: 'assets',
    label: '媒体资产',
    permission: 'assets.read',
    async search(db, query, limit) {
      const pattern = `%${query}%`;
      const rows = await db
        .select({
          id: storageAssets.id,
          displayName: storageAssets.displayName,
          filename: storageAssets.originalFilename,
          kind: storageAssets.mediaKind,
        })
        .from(storageAssets)
        .where(
          or(
            ilike(storageAssets.displayName, pattern),
            ilike(storageAssets.originalFilename, pattern),
            ilike(storageAssets.objectKey, pattern),
          ),
        )
        .limit(limit);
      return rows.map((row) => ({
        id: row.id,
        source: 'assets',
        sourceLabel: '媒体资产',
        kind: row.kind,
        title: row.displayName,
        subtitle: row.filename,
        href: '/assets',
      }));
    },
  },
  {
    code: 'integrations',
    label: '服务连接',
    permission: 'integrations.read',
    async search(db, query, limit) {
      const pattern = `%${query}%`;
      const rows = await db
        .select({
          id: integrationConnections.id,
          name: integrationConnections.name,
          providerCode: integrationConnections.providerCode,
          enabled: integrationConnections.enabled,
        })
        .from(integrationConnections)
        .where(
          or(
            ilike(integrationConnections.name, pattern),
            ilike(integrationConnections.providerCode, pattern),
          ),
        )
        .limit(limit);
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

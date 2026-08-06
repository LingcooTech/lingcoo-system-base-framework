import { ilike, or } from 'drizzle-orm';

import { cmsManifest } from '@lingcoo/frame-cms/contracts';
import { cmsMigrationExtension } from '@lingcoo/frame-cms/migrations';
import { createCmsServerExtension, type CmsServicePorts } from '@lingcoo/frame-cms/server';
import { createCmsWorkerExtension } from '@lingcoo/frame-cms/worker';
import type { Database } from '@lingcoo/frame-database';
import { cmsContentEntries } from '@lingcoo/frame-database/schema';
import { defineExtension } from '@lingcoo/frame-extension-sdk';
import { defineServerExtension } from '@lingcoo/frame-extension-sdk/server';

import { recordAuditEvent } from '../../core/modules/audit/recorder.js';
import type { SearchProvider } from '../../core/modules/search/registry.js';
import type { AppEnv } from '../../host/env.js';
import { DatabaseCmsAssetPort } from './asset-port.js';
import { DatabaseCmsJobPort } from './job-port.js';
import { DatabaseCmsTaxonomyPort } from './taxonomy-port.js';

const cmsSearchProvider: SearchProvider = {
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
};

function createCmsServicePorts(database: Database): CmsServicePorts {
  return {
    assets: new DatabaseCmsAssetPort(database),
    audit: { record: (event) => recordAuditEvent(database, event) },
    jobs: new DatabaseCmsJobPort(),
    taxonomy: new DatabaseCmsTaxonomyPort(database),
  };
}

const cmsServerSurface = createCmsServerExtension({
  database: (app) => app.db,
  actorId(request) {
    if (!request.auth) throw new Error('CMS route requires an authenticated actor');
    return request.auth.accountId;
  },
  requirePermission: (app, permission) => app.requirePermission(permission),
  servicePorts: (app) => createCmsServicePorts(app.db),
  publicSite: (app) => app.publicSiteRegistry,
});

const frameCmsServer = defineServerExtension({
  async register(context) {
    await cmsServerSurface.register(context);
    context.app.searchRegistry.register(cmsSearchProvider);
  },
});

const frameCmsWorker = createCmsWorkerExtension<AppEnv>({
  servicePorts: createCmsServicePorts,
});

export const frameCmsExtension = defineExtension({
  manifest: cmsManifest,
  server: frameCmsServer,
  worker: frameCmsWorker,
  migrations: cmsMigrationExtension,
});

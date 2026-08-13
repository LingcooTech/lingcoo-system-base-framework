import { ilike, or } from 'drizzle-orm';

import { cmsManifest } from '@lingcootech/frame-cms/contracts';
import { cmsMigrationExtension } from '@lingcootech/frame-cms/migrations';
import { createCmsServerExtension, type CmsServicePorts } from '@lingcootech/frame-cms/server';
import { createCmsWorkerExtension } from '@lingcootech/frame-cms/worker';
import type { Database } from '@lingcootech/frame-database';
import { cmsContentEntries } from '@lingcootech/frame-database/schema';
import { defineExtension } from '@lingcootech/frame-extension-sdk';
import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FastifyInstance } from 'fastify';

import { createLegacyAuditPort } from '../audit/ports.js';
import type { SearchProvider } from '../../core/modules/search/registry.js';
import type { AppEnv } from '../../host/env.js';
import { DatabaseCmsAssetPort } from './asset-port.js';
import { createLegacyAssetsPorts } from '../assets/ports.js';
import { DatabaseCmsJobPort } from './job-port.js';
import { createLegacyJobsPortsForDatabase } from '../jobs/ports.js';
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

function createCmsServicePorts(database: Database, env: AppEnv): CmsServicePorts {
  return {
    assets: new DatabaseCmsAssetPort(createLegacyAssetsPorts(database, env).references),
    audit: createLegacyAuditPort(database),
    jobs: new DatabaseCmsJobPort(createLegacyJobsPortsForDatabase(database).commands),
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
  servicePorts: (app) => createCmsServicePorts(app.db, app.appEnv),
  publicSite: (app) => app.publicSiteRegistry,
});

const frameCmsServer = defineServerExtension<FastifyInstance>({
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

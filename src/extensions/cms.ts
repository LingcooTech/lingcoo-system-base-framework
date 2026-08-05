import { cmsManifest } from '@lingcoo/frame-cms/contracts';
import { cmsMigrationExtension } from '@lingcoo/frame-cms/migrations';
import { createCmsServerExtension, type CmsServicePorts } from '@lingcoo/frame-cms/server';
import { createCmsWorkerExtension } from '@lingcoo/frame-cms/worker';
import type { Database } from '@lingcoo/frame-database';
import { defineExtension } from '@lingcoo/frame-extension-sdk';
import { defineServerExtension } from '@lingcoo/frame-extension-sdk/server';

import type { AppEnv } from '../lib/env.js';
import { recordAuditEvent } from '../lib/audit.js';
import { DatabaseCmsAssetPort } from '../modules/assets/cms-port.js';
import { DatabaseCmsJobPort } from '../modules/jobs/cms-port.js';
import { DatabaseCmsTaxonomyPort } from '../modules/metadata/cms-port.js';
import { cmsSearchProvider } from '../modules/search/providers.js';

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

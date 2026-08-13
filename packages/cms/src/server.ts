import type { Database } from '@lingcootech/frame-database';
import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import type { CmsPublicSitePort, CmsServicePorts } from './ports.js';
import {
  cmsContentInputSchema,
  cmsListSchema,
  cmsParamsSchema,
  cmsRedirectInputSchema,
  cmsRedirectParamsSchema,
  cmsScheduleSchema,
  cmsStatusSchema,
  publicCmsListSchema,
  publicCmsParamsSchema,
} from './schemas.js';
import { CmsService } from './service.js';

export interface CmsServerAdapter {
  database(app: FastifyInstance): Database;
  actorId(request: FastifyRequest): string;
  requirePermission(
    app: FastifyInstance,
    permission: 'cms.read' | 'cms.write' | 'cms.publish',
  ): (request: FastifyRequest) => Promise<void>;
  servicePorts(app: FastifyInstance): CmsServicePorts;
  publicSite(app: FastifyInstance): CmsPublicSitePort;
}

export function createCmsServerExtension(adapter: CmsServerAdapter) {
  return defineServerExtension<FastifyInstance>({
    register({ app }) {
      const service = new CmsService(adapter.database(app), adapter.servicePorts(app));
      const publicSite = adapter.publicSite(app);
      publicSite.registerRedirectResolver('frame-cms.redirects', (path) =>
        service.resolveRedirect(path),
      );
      publicSite.registerSitemapCollector('frame-cms.content', async () => [
        { path: '/articles' },
        ...(await service.listPublicRoutes()).map((route) => ({
          path: `/${route.type === 'article' ? 'articles' : 'pages'}/${encodeURIComponent(route.slug)}`,
          updatedAt: route.updatedAt,
        })),
      ]);
      app.get('/api/public/cms/articles', async (request) => {
        const { page, pageSize } = publicCmsListSchema.parse(request.query);
        return service.listPublicArticles(page, pageSize);
      });
      app.get('/api/public/cms/:type/:slug', async (request) => {
        const { type, slug } = publicCmsParamsSchema.parse(request.params);
        return { content: await service.getPublic(type === 'articles' ? 'article' : 'page', slug) };
      });
      app.get(
        '/api/cms/redirects',
        { preHandler: adapter.requirePermission(app, 'cms.read') },
        async () => ({
          items: await service.listRedirects(),
        }),
      );
      app.post(
        '/api/cms/redirects',
        { preHandler: adapter.requirePermission(app, 'cms.write') },
        async (request, reply) =>
          reply.code(201).send({
            redirect: await service.createRedirect(
              cmsRedirectInputSchema.parse(request.body),
              adapter.actorId(request),
            ),
          }),
      );
      app.patch(
        '/api/cms/redirects/:redirectId',
        { preHandler: adapter.requirePermission(app, 'cms.write') },
        async (request) => ({
          redirect: await service.updateRedirect(
            cmsRedirectParamsSchema.parse(request.params).redirectId,
            cmsRedirectInputSchema.parse(request.body),
            adapter.actorId(request),
          ),
        }),
      );
      app.delete(
        '/api/cms/redirects/:redirectId',
        { preHandler: adapter.requirePermission(app, 'cms.write') },
        async (request, reply) => {
          await service.deleteRedirect(
            cmsRedirectParamsSchema.parse(request.params).redirectId,
            adapter.actorId(request),
          );
          return reply.code(204).send();
        },
      );
      app.get(
        '/api/cms/entries',
        { preHandler: adapter.requirePermission(app, 'cms.read') },
        async (request) => service.list(cmsListSchema.parse(request.query)),
      );
      app.post(
        '/api/cms/entries',
        { preHandler: adapter.requirePermission(app, 'cms.write') },
        async (request, reply) =>
          reply.code(201).send({
            content: await service.create(
              cmsContentInputSchema.parse(request.body),
              adapter.actorId(request),
            ),
          }),
      );
      app.get(
        '/api/cms/entries/:contentId',
        { preHandler: adapter.requirePermission(app, 'cms.read') },
        async (request) => ({
          content: await service.get(cmsParamsSchema.parse(request.params).contentId),
        }),
      );
      app.get(
        '/api/cms/entries/:contentId/preview',
        { preHandler: adapter.requirePermission(app, 'cms.read') },
        async (request) => ({
          content: await service.get(cmsParamsSchema.parse(request.params).contentId),
        }),
      );
      app.get(
        '/api/cms/entries/:contentId/versions',
        { preHandler: adapter.requirePermission(app, 'cms.read') },
        async (request) => ({
          items: await service.versions(cmsParamsSchema.parse(request.params).contentId),
        }),
      );
      app.patch(
        '/api/cms/entries/:contentId',
        { preHandler: adapter.requirePermission(app, 'cms.write') },
        async (request) => ({
          content: await service.update(
            cmsParamsSchema.parse(request.params).contentId,
            cmsContentInputSchema.parse(request.body),
            adapter.actorId(request),
          ),
        }),
      );
      app.post(
        '/api/cms/entries/:contentId/schedule',
        { preHandler: adapter.requirePermission(app, 'cms.publish') },
        async (request) => ({
          content: await service.schedule(
            cmsParamsSchema.parse(request.params).contentId,
            cmsScheduleSchema.parse(request.body).publishAt,
            adapter.actorId(request),
          ),
        }),
      );
      app.post(
        '/api/cms/entries/:contentId/status',
        { preHandler: adapter.requirePermission(app, 'cms.publish') },
        async (request) => ({
          content: await service.setStatus(
            cmsParamsSchema.parse(request.params).contentId,
            cmsStatusSchema.parse(request.body).status,
            adapter.actorId(request),
          ),
        }),
      );
    },
  });
}

export { CmsService } from './service.js';
export * from './ports.js';
export * from './schemas.js';

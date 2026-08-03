import type { AppModule } from '../types.js';
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

export const cmsModule: AppModule = {
  name: 'cms',
  register(app) {
    const service = new CmsService(app.db);
    app.get('/api/public/cms/articles', async (request) => {
      const { page, pageSize } = publicCmsListSchema.parse(request.query);
      return service.listPublicArticles(page, pageSize);
    });
    app.get('/api/public/cms/:type/:slug', async (request) => {
      const { type, slug } = publicCmsParamsSchema.parse(request.params);
      return { content: await service.getPublic(type === 'articles' ? 'article' : 'page', slug) };
    });
    app.get('/api/cms/redirects', { preHandler: app.requirePermission('cms.read') }, async () => ({
      items: await service.listRedirects(),
    }));
    app.post(
      '/api/cms/redirects',
      { preHandler: app.requirePermission('cms.write') },
      async (request, reply) =>
        reply.code(201).send({
          redirect: await service.createRedirect(
            cmsRedirectInputSchema.parse(request.body),
            request.auth!.accountId,
          ),
        }),
    );
    app.patch(
      '/api/cms/redirects/:redirectId',
      { preHandler: app.requirePermission('cms.write') },
      async (request) => ({
        redirect: await service.updateRedirect(
          cmsRedirectParamsSchema.parse(request.params).redirectId,
          cmsRedirectInputSchema.parse(request.body),
          request.auth!.accountId,
        ),
      }),
    );
    app.delete(
      '/api/cms/redirects/:redirectId',
      { preHandler: app.requirePermission('cms.write') },
      async (request, reply) => {
        await service.deleteRedirect(
          cmsRedirectParamsSchema.parse(request.params).redirectId,
          request.auth!.accountId,
        );
        return reply.code(204).send();
      },
    );
    app.get(
      '/api/cms/entries',
      { preHandler: app.requirePermission('cms.read') },
      async (request) => service.list(cmsListSchema.parse(request.query)),
    );
    app.post(
      '/api/cms/entries',
      { preHandler: app.requirePermission('cms.write') },
      async (request, reply) =>
        reply.code(201).send({
          content: await service.create(
            cmsContentInputSchema.parse(request.body),
            request.auth!.accountId,
          ),
        }),
    );
    app.get(
      '/api/cms/entries/:contentId',
      { preHandler: app.requirePermission('cms.read') },
      async (request) => ({
        content: await service.get(cmsParamsSchema.parse(request.params).contentId),
      }),
    );
    app.get(
      '/api/cms/entries/:contentId/preview',
      { preHandler: app.requirePermission('cms.read') },
      async (request) => ({
        content: await service.get(cmsParamsSchema.parse(request.params).contentId),
      }),
    );
    app.get(
      '/api/cms/entries/:contentId/versions',
      { preHandler: app.requirePermission('cms.read') },
      async (request) => ({
        items: await service.versions(cmsParamsSchema.parse(request.params).contentId),
      }),
    );
    app.patch(
      '/api/cms/entries/:contentId',
      { preHandler: app.requirePermission('cms.write') },
      async (request) => ({
        content: await service.update(
          cmsParamsSchema.parse(request.params).contentId,
          cmsContentInputSchema.parse(request.body),
          request.auth!.accountId,
        ),
      }),
    );
    app.post(
      '/api/cms/entries/:contentId/schedule',
      { preHandler: app.requirePermission('cms.publish') },
      async (request) => ({
        content: await service.schedule(
          cmsParamsSchema.parse(request.params).contentId,
          cmsScheduleSchema.parse(request.body).publishAt,
          request.auth!.accountId,
        ),
      }),
    );
    app.post(
      '/api/cms/entries/:contentId/status',
      { preHandler: app.requirePermission('cms.publish') },
      async (request) => ({
        content: await service.setStatus(
          cmsParamsSchema.parse(request.params).contentId,
          cmsStatusSchema.parse(request.body).status,
          request.auth!.accountId,
        ),
      }),
    );
  },
};

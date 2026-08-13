import { defineServerExtension } from '@lingcootech/frame-extension-sdk/server';
import type { FastifyInstance } from 'fastify';
import type { FrameFastifyInstance } from '@lingcootech/frame-fastify';
import { resolvePresentationDatabase } from './database.js';
import { presentationInputSchema } from './schemas.js';
import { PresentationService } from './service.js';
import type { PresentationPorts } from './contracts.js';
export type PresentationPortsFactory = (
  app: FastifyInstance,
) => PresentationPorts | Promise<PresentationPorts>;
export function createPresentationServerExtension(options: {
  ports: PresentationPorts | PresentationPortsFactory;
}) {
  return defineServerExtension<FrameFastifyInstance>({
    async register({ app }) {
      const configured =
        typeof options.ports === 'function' ? await options.ports(app) : options.ports;
      const service = new PresentationService(resolvePresentationDatabase(app), configured);
      app.get('/api/public/presentation', async () => ({
        presentation: await service.getPublic(),
      }));
      app.get(
        '/api/presentation',
        { preHandler: app.requirePermission('presentation.read') },
        async () => ({ presentation: await service.get() }),
      );
      app.get(
        '/api/presentation/history',
        { preHandler: app.requirePermission('presentation.read') },
        async () => ({ items: await service.history() }),
      );
      app.patch(
        '/api/presentation',
        { preHandler: app.requirePermission('presentation.write') },
        async (request) => ({
          presentation: await service.update(
            presentationInputSchema.parse(request.body),
            request.auth!.accountId,
          ),
        }),
      );
      app.get('/robots.txt', async (request, reply) => {
        const profile = await service.getPublic();
        const base =
          typeof profile.publicUrl === 'string'
            ? profile.publicUrl
            : `${request.protocol}://${request.hostname}`;
        return reply
          .type('text/plain; charset=utf-8')
          .send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
      });
      app.get('/sitemap.xml', async (request, reply) => {
        const profile = await service.getPublic();
        const base =
          typeof profile.publicUrl === 'string'
            ? profile.publicUrl
            : `${request.protocol}://${request.hostname}`;
        const routes =
          'publicSiteRegistry' in app
            ? await (
                app as FastifyInstance & {
                  publicSiteRegistry: {
                    collectSitemapRoutes(): Promise<readonly { path: string }[]>;
                  };
                }
              ).publicSiteRegistry.collectSitemapRoutes()
            : [];
        const urls = routes
          .map((route) => `<url><loc>${new URL(route.path, base).toString()}</loc></url>`)
          .join('');
        return reply
          .type('application/xml; charset=utf-8')
          .send(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
          );
      });
    },
  });
}

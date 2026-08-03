import type { AppModule } from '../types.js';
import { CmsService } from '../cms/service.js';
import { PresentationService } from '../presentation/service.js';
import { buildRobots, buildSitemap } from './discovery.js';

function requestBaseUrl(request: { protocol: string; hostname: string }) {
  return `${request.protocol}://${request.hostname}`;
}

export const publicSiteModule: AppModule = {
  name: 'public-site',
  register(app) {
    const cms = new CmsService(app.db);
    const presentation = new PresentationService(app.db);

    app.get('/robots.txt', async (request, reply) => {
      const profile = await presentation.getPublic();
      const baseUrl =
        typeof profile.publicUrl === 'string' ? profile.publicUrl : requestBaseUrl(request);
      return reply.type('text/plain; charset=utf-8').send(buildRobots(baseUrl));
    });

    app.get('/sitemap.xml', async (request, reply) => {
      const [profile, routes] = await Promise.all([
        presentation.getPublic(),
        cms.listPublicRoutes(),
      ]);
      const baseUrl =
        typeof profile.publicUrl === 'string' ? profile.publicUrl : requestBaseUrl(request);
      return reply.type('application/xml; charset=utf-8').send(buildSitemap(baseUrl, routes));
    });
  },
};

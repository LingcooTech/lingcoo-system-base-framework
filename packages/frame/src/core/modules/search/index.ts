import type { AppModule } from '../types.js';
import { searchQuerySchema } from './schemas.js';
import { SearchService } from './service.js';

export const searchModule: AppModule = {
  name: 'search',
  register(app) {
    const service = new SearchService(app.db, app.searchRegistry);
    app.get(
      '/api/search/sources',
      { preHandler: app.requirePermission('search.use') },
      async (request) => ({
        items: service.sources(request.auth!.roleCodes, request.auth!.permissions),
      }),
    );
    app.get('/api/search', { preHandler: app.requirePermission('search.use') }, async (request) => {
      const query = searchQuerySchema.parse(request.query);
      return {
        groups: await service.search(
          query.q,
          query.limit,
          request.auth!.roleCodes,
          request.auth!.permissions,
        ),
      };
    });
  },
};

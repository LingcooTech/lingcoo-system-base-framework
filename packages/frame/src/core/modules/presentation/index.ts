import type { AppModule } from '../types.js';
import { presentationInputSchema } from './schemas.js';
import { PresentationService } from './service.js';

export const presentationModule: AppModule = {
  name: 'presentation',
  register(app) {
    const service = new PresentationService(app.db);
    app.get('/api/public/presentation', async () => ({ presentation: await service.getPublic() }));
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
  },
};

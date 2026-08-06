import type { AppModule } from '../types.js';
import { auditParamsSchema, auditQuerySchema } from './schemas.js';
import { AuditService } from './service.js';

export const auditModule: AppModule = {
  name: 'audit',
  register(app) {
    const service = new AuditService(app.db);
    app.get('/api/audit', { preHandler: app.requirePermission('audit.read') }, async (request) =>
      service.list(auditQuerySchema.parse(request.query)),
    );
    app.get(
      '/api/audit/:auditId',
      { preHandler: app.requirePermission('audit.read') },
      async (request) => {
        const { auditId } = auditParamsSchema.parse(request.params);
        return { audit: await service.get(auditId) };
      },
    );
  },
};

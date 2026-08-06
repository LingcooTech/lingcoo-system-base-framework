import type { AppModule } from '../types.js';
import { datasetParamsSchema, exchangeRunsQuerySchema, importDocumentSchema } from './schemas.js';
import { DataExchangeService } from './service.js';

export const dataExchangeModule: AppModule = {
  name: 'data-exchange',
  register(app) {
    const service = new DataExchangeService(app.db, app.datasetRegistry);
    app.get(
      '/api/data-exchange/datasets',
      { preHandler: app.requirePermission('data_exchange.read') },
      async () => ({ items: service.datasets() }),
    );
    app.get(
      '/api/data-exchange/runs',
      { preHandler: app.requirePermission('data_exchange.read') },
      async (request) => {
        const { limit } = exchangeRunsQuerySchema.parse(request.query);
        return { items: await service.history(limit) };
      },
    );
    app.get(
      '/api/data-exchange/datasets/:datasetCode/export',
      { preHandler: app.requirePermission('data_exchange.read') },
      async (request) => {
        const { datasetCode } = datasetParamsSchema.parse(request.params);
        return service.export(datasetCode, request.auth!.accountId);
      },
    );
    app.post(
      '/api/data-exchange/datasets/:datasetCode/preview',
      { preHandler: app.requirePermission('data_exchange.write') },
      async (request) => {
        const { datasetCode } = datasetParamsSchema.parse(request.params);
        const { document } = importDocumentSchema.parse(request.body);
        return { preview: await service.preview(datasetCode, document) };
      },
    );
    app.post(
      '/api/data-exchange/datasets/:datasetCode/import',
      { preHandler: app.requirePermission('data_exchange.write') },
      async (request) => {
        const { datasetCode } = datasetParamsSchema.parse(request.params);
        const { document } = importDocumentSchema.parse(request.body);
        return { result: await service.apply(datasetCode, document, request.auth!.accountId) };
      },
    );
  },
};

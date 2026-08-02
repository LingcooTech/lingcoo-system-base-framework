import type { AppModule } from '../types.js';
import {
  assignmentParamsSchema,
  assignmentQuerySchema,
  codeParamsSchema,
  createAssignmentSchema,
  createDictionaryItemSchema,
  createDictionarySchema,
  createTaxonomySchema,
  createTermSchema,
  itemParamsSchema,
  termParamsSchema,
  updateDictionaryItemSchema,
  updateDictionarySchema,
  updateTaxonomySchema,
  updateTermSchema,
} from './schemas.js';
import { MetadataService } from './service.js';

export const metadataModule: AppModule = {
  name: 'metadata',
  register(app) {
    const service = new MetadataService(app.db);

    app.get(
      '/api/metadata/summary',
      { preHandler: app.requirePermission('metadata.read') },
      async () => service.summary(),
    );
    app.get(
      '/api/metadata/dictionaries',
      { preHandler: app.requirePermission('metadata.read') },
      async () => ({ items: await service.listDictionaries() }),
    );
    app.post(
      '/api/metadata/dictionaries',
      { preHandler: app.requirePermission('metadata.write') },
      async (request, reply) =>
        reply
          .code(201)
          .send({
            dictionary: await service.createDictionary(
              createDictionarySchema.parse(request.body),
              request.auth!.accountId,
            ),
          }),
    );
    app.patch(
      '/api/metadata/dictionaries/:code',
      { preHandler: app.requirePermission('metadata.write') },
      async (request) => {
        const { code } = codeParamsSchema.parse(request.params);
        return {
          dictionary: await service.updateDictionary(
            code,
            updateDictionarySchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );
    app.get(
      '/api/metadata/dictionaries/:code/items',
      { preHandler: app.requirePermission('metadata.read') },
      async (request) => {
        const { code } = codeParamsSchema.parse(request.params);
        return service.listDictionaryItems(code);
      },
    );
    app.post(
      '/api/metadata/dictionaries/:code/items',
      { preHandler: app.requirePermission('metadata.write') },
      async (request, reply) => {
        const { code } = codeParamsSchema.parse(request.params);
        return reply
          .code(201)
          .send({
            item: await service.createDictionaryItem(
              code,
              createDictionaryItemSchema.parse(request.body),
              request.auth!.accountId,
            ),
          });
      },
    );
    app.patch(
      '/api/metadata/dictionaries/:code/items/:itemId',
      { preHandler: app.requirePermission('metadata.write') },
      async (request) => {
        const { code, itemId } = itemParamsSchema.parse(request.params);
        return {
          item: await service.updateDictionaryItem(
            code,
            itemId,
            updateDictionaryItemSchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );

    app.get(
      '/api/metadata/taxonomies',
      { preHandler: app.requirePermission('metadata.read') },
      async () => ({ items: await service.listTaxonomies() }),
    );
    app.post(
      '/api/metadata/taxonomies',
      { preHandler: app.requirePermission('metadata.write') },
      async (request, reply) =>
        reply
          .code(201)
          .send({
            taxonomy: await service.createTaxonomy(
              createTaxonomySchema.parse(request.body),
              request.auth!.accountId,
            ),
          }),
    );
    app.patch(
      '/api/metadata/taxonomies/:code',
      { preHandler: app.requirePermission('metadata.write') },
      async (request) => {
        const { code } = codeParamsSchema.parse(request.params);
        return {
          taxonomy: await service.updateTaxonomy(
            code,
            updateTaxonomySchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );
    app.get(
      '/api/metadata/taxonomies/:code/terms',
      { preHandler: app.requirePermission('metadata.read') },
      async (request) => {
        const { code } = codeParamsSchema.parse(request.params);
        return service.listTerms(code);
      },
    );
    app.post(
      '/api/metadata/taxonomies/:code/terms',
      { preHandler: app.requirePermission('metadata.write') },
      async (request, reply) => {
        const { code } = codeParamsSchema.parse(request.params);
        return reply
          .code(201)
          .send({
            term: await service.createTerm(
              code,
              createTermSchema.parse(request.body),
              request.auth!.accountId,
            ),
          });
      },
    );
    app.patch(
      '/api/metadata/taxonomies/:code/terms/:termId',
      { preHandler: app.requirePermission('metadata.write') },
      async (request) => {
        const { code, termId } = termParamsSchema.parse(request.params);
        return {
          term: await service.updateTerm(
            code,
            termId,
            updateTermSchema.parse(request.body),
            request.auth!.accountId,
          ),
        };
      },
    );

    app.get(
      '/api/metadata/assignments',
      { preHandler: app.requirePermission('metadata.read') },
      async (request) => {
        const query = assignmentQuerySchema.parse(request.query);
        return { items: await service.listAssignments(query.resourceType, query.resourceId) };
      },
    );
    app.post(
      '/api/metadata/assignments',
      { preHandler: app.requirePermission('metadata.assign') },
      async (request, reply) =>
        reply
          .code(201)
          .send({
            assignment: await service.assign(
              createAssignmentSchema.parse(request.body),
              request.auth!.accountId,
            ),
          }),
    );
    app.delete(
      '/api/metadata/assignments/:assignmentId',
      { preHandler: app.requirePermission('metadata.assign') },
      async (request) => {
        const { assignmentId } = assignmentParamsSchema.parse(request.params);
        await service.removeAssignment(assignmentId, request.auth!.accountId);
        return { ok: true };
      },
    );
  },
};

import { and, eq, inArray } from 'drizzle-orm';

import type { CmsTaxonomyPort } from '@lingcoo/frame-cms/server';
import type { Database } from '@lingcoo/frame-database';
import { resourceTerms, taxonomies, taxonomyTerms } from '@lingcoo/frame-database/schema';

export class DatabaseCmsTaxonomyPort implements CmsTaxonomyPort {
  constructor(private readonly db: Database) {}

  async validateActiveTerms(termIds: readonly string[]): Promise<boolean> {
    const uniqueIds = [...new Set(termIds)];
    if (uniqueIds.length === 0) return true;
    const rows = await this.db
      .select({ id: taxonomyTerms.id })
      .from(taxonomyTerms)
      .innerJoin(taxonomies, eq(taxonomyTerms.taxonomyId, taxonomies.id))
      .where(
        and(
          inArray(taxonomyTerms.id, uniqueIds),
          eq(taxonomyTerms.status, 'active'),
          eq(taxonomies.status, 'active'),
        ),
      );
    return rows.length === uniqueIds.length;
  }

  async loadAssignedTerms(resourceType: string, resourceId: string) {
    return this.db
      .select({
        id: taxonomyTerms.id,
        code: taxonomyTerms.code,
        name: taxonomyTerms.name,
        color: taxonomyTerms.color,
        taxonomyCode: taxonomies.code,
        taxonomyName: taxonomies.name,
        taxonomyKind: taxonomies.kind,
      })
      .from(resourceTerms)
      .innerJoin(taxonomyTerms, eq(resourceTerms.termId, taxonomyTerms.id))
      .innerJoin(taxonomies, eq(taxonomyTerms.taxonomyId, taxonomies.id))
      .where(
        and(eq(resourceTerms.resourceType, resourceType), eq(resourceTerms.resourceId, resourceId)),
      );
  }

  async replaceAssignments(
    transaction: Parameters<CmsTaxonomyPort['replaceAssignments']>[0],
    input: Parameters<CmsTaxonomyPort['replaceAssignments']>[1],
  ) {
    await transaction
      .delete(resourceTerms)
      .where(
        and(
          eq(resourceTerms.resourceType, input.resourceType),
          eq(resourceTerms.resourceId, input.resourceId),
        ),
      );
    const termIds = [...new Set(input.termIds)];
    if (termIds.length) {
      await transaction.insert(resourceTerms).values(
        termIds.map((termId) => ({
          termId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          assignedBy: input.actorId,
        })),
      );
    }
  }
}

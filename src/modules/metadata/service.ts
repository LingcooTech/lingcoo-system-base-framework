import { and, asc, count, eq, isNotNull } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import {
  metadataDictionaries,
  metadataDictionaryItems,
  resourceTerms,
  taxonomies,
  taxonomyTerms,
} from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';

type Status = 'active' | 'inactive';
type ValueType = 'string' | 'number' | 'boolean' | 'json';

function validateValue(valueType: ValueType, value: unknown): unknown {
  if (valueType === 'string' && typeof value !== 'string') {
    throw httpError(422, '字典值必须是字符串', 'ValidationError');
  }
  if (valueType === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) {
    throw httpError(422, '字典值必须是有限数字', 'ValidationError');
  }
  if (valueType === 'boolean' && typeof value !== 'boolean') {
    throw httpError(422, '字典值必须是布尔值', 'ValidationError');
  }
  return value;
}

export class MetadataService {
  constructor(private readonly db: Database) {}

  async summary() {
    const [[dictionary], [item], [taxonomy], [term], [assignment]] = await Promise.all([
      this.db.select({ value: count() }).from(metadataDictionaries),
      this.db.select({ value: count() }).from(metadataDictionaryItems),
      this.db.select({ value: count() }).from(taxonomies),
      this.db.select({ value: count() }).from(taxonomyTerms),
      this.db.select({ value: count() }).from(resourceTerms),
    ]);
    return {
      dictionaries: dictionary.value,
      dictionaryItems: item.value,
      taxonomies: taxonomy.value,
      terms: term.value,
      assignments: assignment.value,
    };
  }

  async listDictionaries() {
    const rows = await this.db
      .select()
      .from(metadataDictionaries)
      .orderBy(asc(metadataDictionaries.name));
    return Promise.all(
      rows.map(async (row) => {
        const [aggregate] = await this.db
          .select({ value: count() })
          .from(metadataDictionaryItems)
          .where(eq(metadataDictionaryItems.dictionaryId, row.id));
        return { ...row, itemCount: aggregate.value };
      }),
    );
  }

  async createDictionary(
    input: {
      code: string;
      name: string;
      description?: string;
      valueType: ValueType;
    },
    actorId: string,
  ) {
    const [existing] = await this.db
      .select({ id: metadataDictionaries.id })
      .from(metadataDictionaries)
      .where(eq(metadataDictionaries.code, input.code))
      .limit(1);
    if (existing) throw httpError(409, '字典代码已存在', 'ConflictError');
    const [created] = await this.db
      .insert(metadataDictionaries)
      .values({ ...input, createdBy: actorId })
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.dictionary_created',
      resourceType: 'metadata_dictionary',
      resourceId: created.id,
      actorId,
      metadata: { code: created.code, valueType: created.valueType },
    });
    return created;
  }

  async updateDictionary(
    code: string,
    input: {
      name?: string;
      description?: string;
      valueType?: ValueType;
      status?: Status;
    },
    actorId: string,
  ) {
    const dictionary = await this.requireDictionary(code);
    if (input.valueType && input.valueType !== dictionary.valueType) {
      const [aggregate] = await this.db
        .select({ value: count() })
        .from(metadataDictionaryItems)
        .where(eq(metadataDictionaryItems.dictionaryId, dictionary.id));
      if (aggregate.value > 0)
        throw httpError(409, '字典已有条目，不能修改值类型', 'ConflictError');
    }
    const [updated] = await this.db
      .update(metadataDictionaries)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(metadataDictionaries.id, dictionary.id))
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.dictionary_updated',
      resourceType: 'metadata_dictionary',
      resourceId: dictionary.id,
      actorId,
      metadata: { code, changedFields: Object.keys(input) },
    });
    return updated;
  }

  async listDictionaryItems(code: string) {
    const dictionary = await this.requireDictionary(code);
    const items = await this.db
      .select()
      .from(metadataDictionaryItems)
      .where(eq(metadataDictionaryItems.dictionaryId, dictionary.id))
      .orderBy(asc(metadataDictionaryItems.sortOrder), asc(metadataDictionaryItems.label));
    return { dictionary, items };
  }

  async createDictionaryItem(
    code: string,
    input: {
      code: string;
      label: string;
      value: unknown;
      description?: string;
      sortOrder: number;
      status: Status;
    },
    actorId: string,
  ) {
    const dictionary = await this.requireDictionary(code);
    const [existing] = await this.db
      .select({ id: metadataDictionaryItems.id })
      .from(metadataDictionaryItems)
      .where(
        and(
          eq(metadataDictionaryItems.dictionaryId, dictionary.id),
          eq(metadataDictionaryItems.code, input.code),
        ),
      )
      .limit(1);
    if (existing) throw httpError(409, '字典条目代码已存在', 'ConflictError');
    const [created] = await this.db
      .insert(metadataDictionaryItems)
      .values({
        ...input,
        value: validateValue(dictionary.valueType as ValueType, input.value),
        dictionaryId: dictionary.id,
        createdBy: actorId,
      })
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.dictionary_item_created',
      resourceType: 'metadata_dictionary_item',
      resourceId: created.id,
      actorId,
      metadata: { dictionaryCode: code, itemCode: created.code },
    });
    return created;
  }

  async updateDictionaryItem(
    code: string,
    itemId: string,
    input: {
      label?: string;
      value?: unknown;
      description?: string;
      sortOrder?: number;
      status?: Status;
    },
    actorId: string,
  ) {
    const dictionary = await this.requireDictionary(code);
    const [item] = await this.db
      .select()
      .from(metadataDictionaryItems)
      .where(
        and(
          eq(metadataDictionaryItems.id, itemId),
          eq(metadataDictionaryItems.dictionaryId, dictionary.id),
        ),
      )
      .limit(1);
    if (!item) throw httpError(404, '字典条目不存在', 'NotFoundError');
    const [updated] = await this.db
      .update(metadataDictionaryItems)
      .set({
        ...input,
        ...(input.value !== undefined
          ? { value: validateValue(dictionary.valueType as ValueType, input.value) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(metadataDictionaryItems.id, itemId))
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.dictionary_item_updated',
      resourceType: 'metadata_dictionary_item',
      resourceId: itemId,
      actorId,
      metadata: { dictionaryCode: code, itemCode: item.code, changedFields: Object.keys(input) },
    });
    return updated;
  }

  async listTaxonomies() {
    const rows = await this.db.select().from(taxonomies).orderBy(asc(taxonomies.name));
    return Promise.all(
      rows.map(async (row) => {
        const [aggregate] = await this.db
          .select({ value: count() })
          .from(taxonomyTerms)
          .where(eq(taxonomyTerms.taxonomyId, row.id));
        return { ...row, termCount: aggregate.value };
      }),
    );
  }

  async createTaxonomy(
    input: {
      code: string;
      name: string;
      kind: 'tag' | 'category';
      description?: string;
      hierarchical: boolean;
    },
    actorId: string,
  ) {
    if (input.kind === 'tag' && input.hierarchical)
      throw httpError(422, '标签分类法不能启用层级', 'ValidationError');
    const [existing] = await this.db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(eq(taxonomies.code, input.code))
      .limit(1);
    if (existing) throw httpError(409, '分类法代码已存在', 'ConflictError');
    const [created] = await this.db
      .insert(taxonomies)
      .values({ ...input, createdBy: actorId })
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.taxonomy_created',
      resourceType: 'taxonomy',
      resourceId: created.id,
      actorId,
      metadata: { code: created.code, kind: created.kind },
    });
    return created;
  }

  async updateTaxonomy(
    code: string,
    input: {
      name?: string;
      kind?: 'tag' | 'category';
      description?: string;
      hierarchical?: boolean;
      status?: Status;
    },
    actorId: string,
  ) {
    const taxonomy = await this.requireTaxonomy(code);
    const nextKind = input.kind ?? taxonomy.kind;
    const nextHierarchical = input.hierarchical ?? taxonomy.hierarchical;
    if (nextKind === 'tag' && nextHierarchical)
      throw httpError(422, '标签分类法不能启用层级', 'ValidationError');
    if ((!nextHierarchical || nextKind === 'tag') && taxonomy.hierarchical) {
      const [child] = await this.db
        .select({ id: taxonomyTerms.id })
        .from(taxonomyTerms)
        .where(and(eq(taxonomyTerms.taxonomyId, taxonomy.id), isNotNull(taxonomyTerms.parentId)))
        .limit(1);
      if (child) throw httpError(409, '存在层级词条，不能关闭层级模式', 'ConflictError');
    }
    const [updated] = await this.db
      .update(taxonomies)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(taxonomies.id, taxonomy.id))
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.taxonomy_updated',
      resourceType: 'taxonomy',
      resourceId: taxonomy.id,
      actorId,
      metadata: { code, changedFields: Object.keys(input) },
    });
    return updated;
  }

  async listTerms(code: string) {
    const taxonomy = await this.requireTaxonomy(code);
    const terms = await this.db
      .select()
      .from(taxonomyTerms)
      .where(eq(taxonomyTerms.taxonomyId, taxonomy.id))
      .orderBy(asc(taxonomyTerms.sortOrder), asc(taxonomyTerms.name));
    return { taxonomy, terms };
  }

  async createTerm(
    code: string,
    input: {
      code: string;
      name: string;
      parentId?: string | null;
      color?: string | null;
      sortOrder: number;
      status: Status;
      metadata: Record<string, unknown>;
    },
    actorId: string,
  ) {
    const taxonomy = await this.requireTaxonomy(code);
    await this.validateParent(taxonomy, input.parentId);
    const [existing] = await this.db
      .select({ id: taxonomyTerms.id })
      .from(taxonomyTerms)
      .where(and(eq(taxonomyTerms.taxonomyId, taxonomy.id), eq(taxonomyTerms.code, input.code)))
      .limit(1);
    if (existing) throw httpError(409, '词条代码已存在', 'ConflictError');
    const [created] = await this.db
      .insert(taxonomyTerms)
      .values({ ...input, taxonomyId: taxonomy.id, createdBy: actorId })
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.term_created',
      resourceType: 'taxonomy_term',
      resourceId: created.id,
      actorId,
      metadata: { taxonomyCode: code, termCode: created.code },
    });
    return created;
  }

  async updateTerm(
    code: string,
    termId: string,
    input: {
      name?: string;
      parentId?: string | null;
      color?: string | null;
      sortOrder?: number;
      status?: Status;
      metadata?: Record<string, unknown>;
    },
    actorId: string,
  ) {
    const taxonomy = await this.requireTaxonomy(code);
    const [term] = await this.db
      .select()
      .from(taxonomyTerms)
      .where(and(eq(taxonomyTerms.id, termId), eq(taxonomyTerms.taxonomyId, taxonomy.id)))
      .limit(1);
    if (!term) throw httpError(404, '分类词条不存在', 'NotFoundError');
    if (input.parentId !== undefined) {
      if (input.parentId === termId)
        throw httpError(422, '词条不能以自己为父级', 'ValidationError');
      await this.validateParent(taxonomy, input.parentId);
      let cursor = input.parentId;
      while (cursor) {
        if (cursor === termId)
          throw httpError(422, '词条不能移动到自己的后代节点', 'ValidationError');
        const [parent] = await this.db
          .select({ parentId: taxonomyTerms.parentId })
          .from(taxonomyTerms)
          .where(eq(taxonomyTerms.id, cursor))
          .limit(1);
        cursor = parent?.parentId ?? null;
      }
    }
    const [updated] = await this.db
      .update(taxonomyTerms)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(taxonomyTerms.id, termId))
      .returning();
    await recordAuditEvent(this.db, {
      action: 'metadata.term_updated',
      resourceType: 'taxonomy_term',
      resourceId: termId,
      actorId,
      metadata: { taxonomyCode: code, termCode: term.code, changedFields: Object.keys(input) },
    });
    return updated;
  }

  async listAssignments(resourceType: string, resourceId: string) {
    return this.db
      .select({
        id: resourceTerms.id,
        resourceType: resourceTerms.resourceType,
        resourceId: resourceTerms.resourceId,
        createdAt: resourceTerms.createdAt,
        term: {
          id: taxonomyTerms.id,
          code: taxonomyTerms.code,
          name: taxonomyTerms.name,
          color: taxonomyTerms.color,
        },
        taxonomy: { code: taxonomies.code, name: taxonomies.name, kind: taxonomies.kind },
      })
      .from(resourceTerms)
      .innerJoin(taxonomyTerms, eq(resourceTerms.termId, taxonomyTerms.id))
      .innerJoin(taxonomies, eq(taxonomyTerms.taxonomyId, taxonomies.id))
      .where(
        and(eq(resourceTerms.resourceType, resourceType), eq(resourceTerms.resourceId, resourceId)),
      );
  }

  async assign(
    input: { resourceType: string; resourceId: string; taxonomyCode: string; termCode: string },
    actorId: string,
  ) {
    const taxonomy = await this.requireTaxonomy(input.taxonomyCode);
    const [term] = await this.db
      .select()
      .from(taxonomyTerms)
      .where(and(eq(taxonomyTerms.taxonomyId, taxonomy.id), eq(taxonomyTerms.code, input.termCode)))
      .limit(1);
    if (!term || term.status !== 'active' || taxonomy.status !== 'active')
      throw httpError(422, '分类词条不存在或未启用', 'ValidationError');
    const [assignment] = await this.db
      .insert(resourceTerms)
      .values({
        termId: term.id,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        assignedBy: actorId,
      })
      .onConflictDoNothing()
      .returning();
    if (assignment)
      await recordAuditEvent(this.db, {
        action: 'metadata.term_assigned',
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        actorId,
        metadata: { taxonomyCode: input.taxonomyCode, termCode: input.termCode },
      });
    const rows = await this.listAssignments(input.resourceType, input.resourceId);
    return rows.find((row) => row.term.id === term.id)!;
  }

  async removeAssignment(assignmentId: string, actorId: string) {
    const [assignment] = await this.db
      .delete(resourceTerms)
      .where(eq(resourceTerms.id, assignmentId))
      .returning();
    if (!assignment) throw httpError(404, '分类关联不存在', 'NotFoundError');
    await recordAuditEvent(this.db, {
      action: 'metadata.term_unassigned',
      resourceType: assignment.resourceType,
      resourceId: assignment.resourceId,
      actorId,
      metadata: { assignmentId },
    });
  }

  private async requireDictionary(code: string) {
    const [row] = await this.db
      .select()
      .from(metadataDictionaries)
      .where(eq(metadataDictionaries.code, code))
      .limit(1);
    if (!row) throw httpError(404, '数据字典不存在', 'NotFoundError');
    return row;
  }

  private async requireTaxonomy(code: string) {
    const [row] = await this.db.select().from(taxonomies).where(eq(taxonomies.code, code)).limit(1);
    if (!row) throw httpError(404, '分类法不存在', 'NotFoundError');
    return row;
  }

  private async validateParent(taxonomy: typeof taxonomies.$inferSelect, parentId?: string | null) {
    if (!parentId) return;
    if (!taxonomy.hierarchical) throw httpError(422, '当前分类法不支持层级', 'ValidationError');
    const [parent] = await this.db
      .select({ id: taxonomyTerms.id })
      .from(taxonomyTerms)
      .where(and(eq(taxonomyTerms.id, parentId), eq(taxonomyTerms.taxonomyId, taxonomy.id)))
      .limit(1);
    if (!parent) throw httpError(422, '父级词条不存在', 'ValidationError');
  }
}

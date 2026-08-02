import { asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import {
  metadataDictionaries,
  metadataDictionaryItems,
  taxonomies,
  taxonomyTerms,
} from '../../db/schema.js';
import { metadataCodeSchema } from '../metadata/schemas.js';
import type { DatasetAdapter } from './registry.js';

const statusSchema = z.enum(['active', 'inactive']);
const envelopeSchema = z.object({
  formatVersion: z.literal(1),
  dataset: z.string(),
  exportedAt: z.iso.datetime(),
  records: z.array(z.unknown()).max(10000),
});

const dictionaryItemSchema = z.object({
  code: metadataCodeSchema,
  label: z.string().trim().min(1).max(160),
  value: z.unknown(),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(-100000).max(100000),
  status: statusSchema,
});
const dictionaryRecordSchema = z.object({
  code: metadataCodeSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  valueType: z.enum(['string', 'number', 'boolean', 'json']),
  status: statusSchema,
  items: z.array(dictionaryItemSchema).max(5000),
});

const termRecordSchema = z.object({
  code: metadataCodeSchema,
  name: z.string().trim().min(1).max(160),
  parentCode: metadataCodeSchema.nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  sortOrder: z.number().int().min(-100000).max(100000),
  status: statusSchema,
  metadata: z.record(z.string(), z.unknown()),
});
const taxonomyRecordSchema = z.object({
  code: metadataCodeSchema,
  name: z.string().trim().min(1).max(120),
  kind: z.enum(['tag', 'category']),
  description: z.string().trim().max(500).nullable().optional(),
  hierarchical: z.boolean(),
  status: statusSchema,
  terms: z.array(termRecordSchema).max(5000),
});

function parseRecords<T>(document: unknown, dataset: string, schema: z.ZodType<T>): T[] {
  const envelope = envelopeSchema.parse(document);
  if (envelope.dataset !== dataset) throw new Error(`数据集不匹配，应为 ${dataset}`);
  return envelope.records.map((record) => schema.parse(record));
}

function duplicateErrors(values: string[], label: string): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].map((value) => `${label}重复：${value}`);
}

function valueMatches(type: string, value: unknown): boolean {
  return type === 'string'
    ? typeof value === 'string'
    : type === 'number'
      ? typeof value === 'number' && Number.isFinite(value)
      : type === 'boolean'
        ? typeof value === 'boolean'
        : true;
}

export const dictionaryDatasetAdapter: DatasetAdapter = {
  code: 'metadata.dictionaries',
  name: '数据字典',
  description: '字典定义、值类型和全部字典条目。',
  async export(db) {
    const dictionaries = await db
      .select()
      .from(metadataDictionaries)
      .orderBy(asc(metadataDictionaries.code));
    const records = await Promise.all(
      dictionaries.map(async (dictionary) => {
        const items = await db
          .select({
            code: metadataDictionaryItems.code,
            label: metadataDictionaryItems.label,
            value: metadataDictionaryItems.value,
            description: metadataDictionaryItems.description,
            sortOrder: metadataDictionaryItems.sortOrder,
            status: metadataDictionaryItems.status,
          })
          .from(metadataDictionaryItems)
          .where(eq(metadataDictionaryItems.dictionaryId, dictionary.id))
          .orderBy(asc(metadataDictionaryItems.sortOrder));
        return {
          code: dictionary.code,
          name: dictionary.name,
          description: dictionary.description,
          valueType: dictionary.valueType,
          status: dictionary.status,
          items,
        };
      }),
    );
    return { formatVersion: 1, dataset: this.code, exportedAt: new Date().toISOString(), records };
  },
  async preview(db, document) {
    const records = parseRecords(document, this.code, dictionaryRecordSchema);
    const existing = records.length
      ? await db
          .select({ code: metadataDictionaries.code, valueType: metadataDictionaries.valueType })
          .from(metadataDictionaries)
          .where(
            inArray(
              metadataDictionaries.code,
              records.map((record) => record.code),
            ),
          )
      : [];
    const existingMap = new Map(existing.map((row) => [row.code, row]));
    const errors = duplicateErrors(
      records.map((record) => record.code),
      '字典代码',
    );
    let recordCount = records.length;
    for (const record of records) {
      errors.push(
        ...duplicateErrors(
          record.items.map((item) => item.code),
          `${record.code} 条目代码`,
        ),
      );
      recordCount += record.items.length;
      if (
        existingMap.get(record.code)?.valueType !== undefined &&
        existingMap.get(record.code)?.valueType !== record.valueType
      ) {
        errors.push(`字典 ${record.code} 的值类型与现有定义不一致`);
      }
      for (const item of record.items)
        if (!valueMatches(record.valueType, item.value))
          errors.push(`字典 ${record.code} 的条目 ${item.code} 值类型无效`);
    }
    const updates = records.filter((record) => existingMap.has(record.code)).length;
    return {
      valid: errors.length === 0,
      recordCount,
      creates: records.length - updates,
      updates,
      errors,
    };
  },
  async apply(db, document, actorId) {
    const preview = await this.preview(db, document);
    if (!preview.valid) throw new Error(preview.errors.join('；'));
    const records = parseRecords(document, this.code, dictionaryRecordSchema);
    for (const record of records) {
      const [dictionary] = await db
        .insert(metadataDictionaries)
        .values({
          code: record.code,
          name: record.name,
          description: record.description,
          valueType: record.valueType,
          status: record.status,
          createdBy: actorId,
        })
        .onConflictDoUpdate({
          target: metadataDictionaries.code,
          set: {
            name: record.name,
            description: record.description,
            status: record.status,
            updatedAt: new Date(),
          },
        })
        .returning();
      for (const item of record.items) {
        await db
          .insert(metadataDictionaryItems)
          .values({ ...item, dictionaryId: dictionary.id, createdBy: actorId })
          .onConflictDoUpdate({
            target: [metadataDictionaryItems.dictionaryId, metadataDictionaryItems.code],
            set: {
              label: item.label,
              value: item.value,
              description: item.description,
              sortOrder: item.sortOrder,
              status: item.status,
              updatedAt: new Date(),
            },
          });
      }
    }
    return preview;
  },
};

function hierarchyErrors(record: z.infer<typeof taxonomyRecordSchema>): string[] {
  const errors = duplicateErrors(
    record.terms.map((term) => term.code),
    `${record.code} 词条代码`,
  );
  const terms = new Map(record.terms.map((term) => [term.code, term]));
  if (record.kind === 'tag' && record.hierarchical)
    errors.push(`标签分类法 ${record.code} 不能启用层级`);
  for (const term of record.terms) {
    if (term.parentCode && !record.hierarchical)
      errors.push(`${record.code}.${term.code} 在非层级分类法中设置了父级`);
    if (term.parentCode && !terms.has(term.parentCode))
      errors.push(`${record.code}.${term.code} 的父级不存在`);
    const visited = new Set([term.code]);
    let cursor = term.parentCode;
    while (cursor) {
      if (visited.has(cursor)) {
        errors.push(`${record.code}.${term.code} 存在父子循环`);
        break;
      }
      visited.add(cursor);
      cursor = terms.get(cursor)?.parentCode ?? null;
    }
  }
  return errors;
}

export const taxonomyDatasetAdapter: DatasetAdapter = {
  code: 'metadata.taxonomies',
  name: '分类与标签',
  description: '分类法定义、层级关系、标签与词条元数据。',
  async export(db) {
    const rows = await db.select().from(taxonomies).orderBy(asc(taxonomies.code));
    const records = await Promise.all(
      rows.map(async (taxonomy) => {
        const terms = await db
          .select({
            id: taxonomyTerms.id,
            code: taxonomyTerms.code,
            name: taxonomyTerms.name,
            parentId: taxonomyTerms.parentId,
            color: taxonomyTerms.color,
            sortOrder: taxonomyTerms.sortOrder,
            status: taxonomyTerms.status,
            metadata: taxonomyTerms.metadata,
          })
          .from(taxonomyTerms)
          .where(eq(taxonomyTerms.taxonomyId, taxonomy.id))
          .orderBy(asc(taxonomyTerms.sortOrder));
        const codes = new Map(terms.map((term) => [term.id, term.code]));
        return {
          code: taxonomy.code,
          name: taxonomy.name,
          kind: taxonomy.kind,
          description: taxonomy.description,
          hierarchical: taxonomy.hierarchical,
          status: taxonomy.status,
          terms: terms.map((term) => ({
            code: term.code,
            name: term.name,
            parentCode: term.parentId ? (codes.get(term.parentId) ?? null) : null,
            color: term.color,
            sortOrder: term.sortOrder,
            status: term.status,
            metadata: term.metadata,
          })),
        };
      }),
    );
    return { formatVersion: 1, dataset: this.code, exportedAt: new Date().toISOString(), records };
  },
  async preview(db, document) {
    const records = parseRecords(document, this.code, taxonomyRecordSchema);
    const existing = records.length
      ? await db
          .select({
            code: taxonomies.code,
            kind: taxonomies.kind,
            hierarchical: taxonomies.hierarchical,
          })
          .from(taxonomies)
          .where(
            inArray(
              taxonomies.code,
              records.map((record) => record.code),
            ),
          )
      : [];
    const existingMap = new Map(existing.map((row) => [row.code, row]));
    const errors = duplicateErrors(
      records.map((record) => record.code),
      '分类法代码',
    );
    let recordCount = records.length;
    for (const record of records) {
      recordCount += record.terms.length;
      errors.push(...hierarchyErrors(record));
      const current = existingMap.get(record.code);
      if (current && (current.kind !== record.kind || current.hierarchical !== record.hierarchical))
        errors.push(`分类法 ${record.code} 的类型或层级模式与现有定义不一致`);
    }
    const updates = records.filter((record) => existingMap.has(record.code)).length;
    return {
      valid: errors.length === 0,
      recordCount,
      creates: records.length - updates,
      updates,
      errors,
    };
  },
  async apply(db, document, actorId) {
    const preview = await this.preview(db, document);
    if (!preview.valid) throw new Error(preview.errors.join('；'));
    const records = parseRecords(document, this.code, taxonomyRecordSchema);
    for (const record of records) {
      const [taxonomy] = await db
        .insert(taxonomies)
        .values({
          code: record.code,
          name: record.name,
          kind: record.kind,
          description: record.description,
          hierarchical: record.hierarchical,
          status: record.status,
          createdBy: actorId,
        })
        .onConflictDoUpdate({
          target: taxonomies.code,
          set: {
            name: record.name,
            description: record.description,
            status: record.status,
            updatedAt: new Date(),
          },
        })
        .returning();
      const ids = new Map<string, string>();
      for (const term of record.terms) {
        const [saved] = await db
          .insert(taxonomyTerms)
          .values({
            taxonomyId: taxonomy.id,
            code: term.code,
            name: term.name,
            parentId: null,
            color: term.color,
            sortOrder: term.sortOrder,
            status: term.status,
            metadata: term.metadata,
            createdBy: actorId,
          })
          .onConflictDoUpdate({
            target: [taxonomyTerms.taxonomyId, taxonomyTerms.code],
            set: {
              name: term.name,
              parentId: null,
              color: term.color,
              sortOrder: term.sortOrder,
              status: term.status,
              metadata: term.metadata,
              updatedAt: new Date(),
            },
          })
          .returning({ id: taxonomyTerms.id });
        ids.set(term.code, saved.id);
      }
      for (const term of record.terms)
        if (term.parentCode)
          await db
            .update(taxonomyTerms)
            .set({ parentId: ids.get(term.parentCode)! })
            .where(eq(taxonomyTerms.id, ids.get(term.code)!));
    }
    return preview;
  },
};

export const baseDatasetAdapters = [dictionaryDatasetAdapter, taxonomyDatasetAdapter];

import { desc, eq } from 'drizzle-orm';

import type { Database } from '../../db/client.js';
import { accounts, dataExchangeRuns } from '../../db/schema.js';
import { recordAuditEvent } from '../../lib/audit.js';
import { httpError } from '../../lib/http-error.js';
import type { DatasetRegistry } from './registry.js';

export class DataExchangeService {
  constructor(
    private readonly db: Database,
    private readonly registry: DatasetRegistry,
  ) {}

  datasets() {
    return this.registry.list().map(({ code, name, description }) => ({
      code,
      name,
      description,
      format: 'json',
      formatVersion: 1,
    }));
  }

  async history(limit: number) {
    return this.db
      .select({
        id: dataExchangeRuns.id,
        datasetCode: dataExchangeRuns.datasetCode,
        direction: dataExchangeRuns.direction,
        format: dataExchangeRuns.format,
        status: dataExchangeRuns.status,
        recordCount: dataExchangeRuns.recordCount,
        summary: dataExchangeRuns.summary,
        errorMessage: dataExchangeRuns.errorMessage,
        createdAt: dataExchangeRuns.createdAt,
        actor: { id: accounts.id, email: accounts.email, displayName: accounts.displayName },
      })
      .from(dataExchangeRuns)
      .leftJoin(accounts, eq(dataExchangeRuns.createdBy, accounts.id))
      .orderBy(desc(dataExchangeRuns.createdAt))
      .limit(limit);
  }

  async export(datasetCode: string, actorId: string) {
    const adapter = this.requireAdapter(datasetCode);
    const document = await adapter.export(this.db);
    await this.db.insert(dataExchangeRuns).values({
      datasetCode,
      direction: 'export',
      status: 'succeeded',
      recordCount: document.records.length,
      summary: { formatVersion: document.formatVersion },
      createdBy: actorId,
    });
    await recordAuditEvent(this.db, {
      action: 'data_exchange.exported',
      resourceType: 'dataset',
      resourceId: datasetCode,
      actorId,
      metadata: { recordCount: document.records.length, format: 'json' },
    });
    return document;
  }

  async preview(datasetCode: string, document: unknown) {
    return this.requireAdapter(datasetCode).preview(this.db, document);
  }

  async apply(datasetCode: string, document: unknown, actorId: string) {
    const adapter = this.requireAdapter(datasetCode);
    try {
      const result = await this.db.transaction(async (transaction) =>
        adapter.apply(transaction as unknown as Database, document, actorId),
      );
      await this.db.insert(dataExchangeRuns).values({
        datasetCode,
        direction: 'import',
        status: 'succeeded',
        recordCount: result.recordCount,
        summary: { creates: result.creates, updates: result.updates },
        createdBy: actorId,
      });
      await recordAuditEvent(this.db, {
        action: 'data_exchange.imported',
        resourceType: 'dataset',
        resourceId: datasetCode,
        actorId,
        metadata: {
          recordCount: result.recordCount,
          creates: result.creates,
          updates: result.updates,
        },
      });
      return result;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message.slice(0, 1000) : '导入失败';
      await this.db.insert(dataExchangeRuns).values({
        datasetCode,
        direction: 'import',
        status: 'failed',
        errorMessage: message,
        createdBy: actorId,
      });
      await recordAuditEvent(this.db, {
        action: 'data_exchange.import_failed',
        resourceType: 'dataset',
        resourceId: datasetCode,
        actorId,
        metadata: { format: 'json' },
      });
      throw cause;
    }
  }

  private requireAdapter(code: string) {
    const adapter = this.registry.get(code);
    if (!adapter) throw httpError(404, '数据集未注册', 'NotFoundError');
    return adapter;
  }
}

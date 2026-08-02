import type { Database } from '../../db/client.js';

export interface ExchangeDocument {
  formatVersion: 1;
  dataset: string;
  exportedAt: string;
  records: unknown[];
}

export interface ExchangePreview {
  valid: boolean;
  recordCount: number;
  creates: number;
  updates: number;
  errors: string[];
}

export interface DatasetAdapter {
  code: string;
  name: string;
  description: string;
  export(db: Database): Promise<ExchangeDocument>;
  preview(db: Database, document: unknown): Promise<ExchangePreview>;
  apply(db: Database, document: unknown, actorId: string): Promise<ExchangePreview>;
}

export class DatasetRegistry {
  private readonly adapters = new Map<string, DatasetAdapter>();

  register(adapter: DatasetAdapter): void {
    if (this.adapters.has(adapter.code)) {
      throw new Error(`Dataset adapter already registered: ${adapter.code}`);
    }
    this.adapters.set(adapter.code, adapter);
  }

  list(): DatasetAdapter[] {
    return [...this.adapters.values()];
  }

  get(code: string): DatasetAdapter | undefined {
    return this.adapters.get(code);
  }
}

import type { AuditCommandPort } from '@lingcootech/frame-audit';

export type JobsAuditPort = AuditCommandPort;

export interface JobsPorts {
  audit: JobsAuditPort;
  commands: JobsCommandPort;
}

export function createNoopJobsPorts(): JobsPorts {
  const unavailable = () => {
    throw Object.assign(new Error('Jobs persistence is not configured'), {
      name: 'ConfigurationError',
      statusCode: 503,
    });
  };
  return {
    audit: { async record() {} },
    commands: {
      async enqueue() {
        return unavailable();
      },
      async publish() {
        return unavailable();
      },
    },
  };
}
import type { Database } from '@lingcootech/frame-database';

export type JobsTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface JobEnqueueCommand {
  kind: string;
  payload?: Record<string, unknown>;
  queue?: string;
  priority?: number;
  maxAttempts?: number;
  availableAt?: Date;
  dedupeKey?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdBy?: string;
}

export interface OutboxPublishCommand {
  topic: string;
  payload?: Record<string, unknown>;
  aggregateType?: string;
  aggregateId?: string;
  dedupeKey?: string;
  availableAt?: Date;
}

export interface JobsCommandPort {
  enqueue(input: JobEnqueueCommand, transaction?: JobsTransaction): Promise<{ id: string }>;
  publish(input: OutboxPublishCommand, transaction?: JobsTransaction): Promise<void>;
}

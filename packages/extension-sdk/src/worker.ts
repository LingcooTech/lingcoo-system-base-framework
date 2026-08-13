import type { ExtensionEnvironmentValues } from './environment.js';

export interface JobHandlerContext {
  jobId: string;
  payload: Record<string, unknown>;
  signal: AbortSignal;
}

export type JobHandler = (
  context: JobHandlerContext,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export interface OutboxEventContext {
  eventId: string;
  topic: string;
  payload: Record<string, unknown>;
  aggregateType: string | null;
  aggregateId: string | null;
}

export type OutboxSubscriber = (context: OutboxEventContext) => Promise<void> | void;

export interface WorkerExtensionContext<TEnvironment = unknown, TDatabase = unknown> {
  env: TEnvironment;
  environment: ExtensionEnvironmentValues;
  database: TDatabase;
  registerJob(kind: string, handler: JobHandler): void;
  subscribe(topic: string, subscriber: OutboxSubscriber): void;
}

export interface WorkerExtensionSurface<TEnvironment = unknown, TDatabase = unknown> {
  register(context: WorkerExtensionContext<TEnvironment, TDatabase>): void;
}

export function defineWorkerExtension<TEnvironment = unknown, TDatabase = unknown>(
  surface: WorkerExtensionSurface<TEnvironment, TDatabase>,
): WorkerExtensionSurface<TEnvironment, TDatabase> {
  return surface;
}

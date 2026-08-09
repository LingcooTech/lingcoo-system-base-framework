import type {
  JobHandler,
  JobHandlerContext,
  OutboxEventContext,
  OutboxSubscriber,
} from '@lingcootech/frame-extension-sdk/worker';

export type { JobHandler, JobHandlerContext, OutboxEventContext, OutboxSubscriber };

export class JobHandlerRegistry {
  private readonly handlers = new Map<string, JobHandler>();

  register(kind: string, handler: JobHandler): void {
    if (this.handlers.has(kind)) throw new Error(`Job handler already registered: ${kind}`);
    this.handlers.set(kind, handler);
  }

  async execute(kind: string, context: JobHandlerContext): Promise<Record<string, unknown>> {
    const handler = this.handlers.get(kind);
    if (!handler) throw new Error(`Unsupported job kind: ${kind}`);
    return handler(context);
  }

  listKinds(): string[] {
    return [...this.handlers.keys()].sort();
  }
}

export class OutboxSubscriberRegistry {
  private readonly subscribers = new Map<string, OutboxSubscriber[]>();

  subscribe(topic: string, subscriber: OutboxSubscriber): void {
    const current = this.subscribers.get(topic) ?? [];
    current.push(subscriber);
    this.subscribers.set(topic, current);
  }

  async dispatch(context: OutboxEventContext): Promise<void> {
    const subscribers = [
      ...(this.subscribers.get(context.topic) ?? []),
      ...(this.subscribers.get('*') ?? []),
    ];
    for (const subscriber of subscribers) await subscriber(context);
  }

  listTopics(): string[] {
    return [...this.subscribers.keys()].sort();
  }
}

export type TelemetryAttribute = boolean | number | string;
export type TelemetryAttributes = Readonly<Record<string, TelemetryAttribute>>;

export interface TelemetryPort {
  readonly id: string;
  withSpan<T>(
    name: string,
    operation: () => T | Promise<T>,
    attributes?: TelemetryAttributes,
  ): Promise<T>;
  recordException(error: unknown, attributes?: TelemetryAttributes): void;
  shutdown(): Promise<void>;
}

export function createNoopTelemetry(): TelemetryPort {
  return {
    id: 'noop',
    async withSpan<T>(_name: string, operation: () => T | Promise<T>): Promise<T> {
      return operation();
    },
    recordException() {},
    async shutdown() {},
  };
}

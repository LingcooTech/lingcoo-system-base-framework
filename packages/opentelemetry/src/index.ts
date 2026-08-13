import { SpanStatusCode, trace, type Tracer } from '@opentelemetry/api';

import type { TelemetryAttributes, TelemetryPort } from '@lingcootech/frame-kernel/ports';

export interface OpenTelemetryAdapterOptions {
  instrumentationName?: string;
  instrumentationVersion?: string;
  tracer?: Tracer;
}

function errorValue(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * Bridges Kernel telemetry to the globally configured OpenTelemetry provider.
 * Provider/exporter lifecycle belongs to the application composition root.
 */
export function createOpenTelemetryAdapter(
  options: OpenTelemetryAdapterOptions = {},
): TelemetryPort {
  const tracer =
    options.tracer ??
    trace.getTracer(
      options.instrumentationName ?? '@lingcootech/frame',
      options.instrumentationVersion,
    );
  return {
    id: 'opentelemetry',
    withSpan<T>(name: string, operation: () => T | Promise<T>, attributes?: TelemetryAttributes) {
      return tracer.startActiveSpan(name, { attributes }, async (span) => {
        try {
          const result = await operation();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(errorValue(error));
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      });
    },
    recordException(error: unknown, attributes?: TelemetryAttributes) {
      const active = trace.getActiveSpan();
      if (active) {
        if (attributes) active.setAttributes(attributes);
        active.recordException(errorValue(error));
        active.setStatus({ code: SpanStatusCode.ERROR });
        return;
      }
      const span = tracer.startSpan('frame.exception', { attributes });
      span.recordException(errorValue(error));
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    },
    async shutdown() {
      // The application owns SDK/provider/exporter lifecycle.
    },
  };
}

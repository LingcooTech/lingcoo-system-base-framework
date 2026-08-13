import assert from 'node:assert/strict';
import test from 'node:test';

import { createOpenTelemetryAdapter } from '../src/index.js';

test('OpenTelemetry adapter works with the official no-op provider', async () => {
  const telemetry = createOpenTelemetryAdapter();
  const result = await telemetry.withSpan('kernel.test', async () => 42, {
    component: 'test',
  });

  assert.equal(result, 42);
  assert.doesNotThrow(() => telemetry.recordException(new Error('expected')));
  await telemetry.shutdown();
});

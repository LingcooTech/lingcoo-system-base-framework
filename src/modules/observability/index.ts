import { randomUUID, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance } from 'fastify';

import type { AppModule } from '../types.js';
import { incidentParamsSchema, incidentQuerySchema, updateIncidentSchema } from './schemas.js';

function tokenMatches(expected: string, provided: string | undefined): boolean {
  if (!provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return (
    expectedBuffer.length === providedBuffer.length &&
    timingSafeEqual(expectedBuffer, providedBuffer)
  );
}

export function installObservability(app: FastifyInstance): void {
  const instanceId = `api_${randomUUID()}`;
  const startedAt = new Date();
  let heartbeatTimer: NodeJS.Timeout | undefined;

  app.decorateRequest('metricsStartedAt', null);
  app.addHook('onRequest', (request, _reply, done) => {
    request.metricsStartedAt = app.observability.metrics.beginRequest();
    done();
  });
  app.addHook('onResponse', (request, reply, done) => {
    app.observability.metrics.finishRequest(
      request.metricsStartedAt,
      request.method,
      request.routeOptions.url || request.url.split('?')[0] || 'unmatched',
      reply.statusCode,
    );
    done();
  });
  app.addHook('onReady', async () => {
    const sendHeartbeat = () =>
      app.observability
        .heartbeat({
          serviceType: 'api',
          instanceId,
          version: app.appEnv.APP_VERSION,
          status: 'healthy',
          startedAt,
          metadata: { environment: app.appEnv.NODE_ENV },
        })
        .catch((error: unknown) =>
          app.log.warn(
            { errorName: error instanceof Error ? error.name : 'UnknownError' },
            'api heartbeat failed',
          ),
        );
    await sendHeartbeat();
    heartbeatTimer = setInterval(() => void sendHeartbeat(), 15_000);
    heartbeatTimer.unref();
  });
  app.addHook('onClose', async () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  });
}

export const observabilityModule: AppModule = {
  name: 'observability',
  register(app) {
    app.get(
      '/api/observability/summary',
      { preHandler: app.requirePermission('observability.read') },
      async () => ({
        ...(await app.observability.summary()),
        metricsEndpointEnabled: Boolean(app.appEnv.METRICS_BEARER_TOKEN),
      }),
    );
    app.get(
      '/api/observability/requests',
      { preHandler: app.requirePermission('observability.read') },
      async () => ({ items: app.observability.metrics.breakdown() }),
    );
    app.get(
      '/api/observability/incidents',
      { preHandler: app.requirePermission('observability.read') },
      async (request) => {
        const { status } = incidentQuerySchema.parse(request.query);
        return { items: await app.observability.listIncidents(status) };
      },
    );
    app.patch(
      '/api/observability/incidents/:incidentId',
      { preHandler: app.requirePermission('observability.manage') },
      async (request) => {
        const { incidentId } = incidentParamsSchema.parse(request.params);
        const { status } = updateIncidentSchema.parse(request.body);
        return {
          incident: await app.observability.setIncidentStatus(
            incidentId,
            status,
            request.auth!.accountId,
          ),
        };
      },
    );
    app.get('/metrics', async (request, reply) => {
      const expected = app.appEnv.METRICS_BEARER_TOKEN;
      if (!expected) return reply.code(404).send({ error: 'NotFound', message: '接口不存在' });
      const authorization = request.headers.authorization;
      const bearer = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;
      const direct = request.headers['x-metrics-token'];
      const provided = bearer ?? (Array.isArray(direct) ? direct[0] : direct);
      if (!tokenMatches(expected, provided))
        return reply.code(401).send({ error: 'UnauthorizedError', message: '指标访问凭证无效' });
      return reply
        .type('text/plain; version=0.0.4; charset=utf-8')
        .send(await app.observability.prometheus());
    });
  },
};

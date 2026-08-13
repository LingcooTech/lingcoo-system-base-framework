import { and, desc, eq, ilike, or } from 'drizzle-orm';

import type { Database } from '@lingcootech/frame-database';
import { integrationConnections } from '@lingcootech/frame-database/schema';
import type { IntegrationsPorts } from '@lingcootech/frame-integrations';

import { createLegacyAuditPort } from '../audit/ports.js';

export function createLegacyIntegrationsPorts(database: Database): IntegrationsPorts {
  return {
    audit: createLegacyAuditPort(database),
    connections: {
      listEnabled(providerCode) {
        return database
          .select({
            id: integrationConnections.id,
            providerCode: integrationConnections.providerCode,
            name: integrationConnections.name,
          })
          .from(integrationConnections)
          .where(
            and(
              eq(integrationConnections.providerCode, providerCode),
              eq(integrationConnections.enabled, true),
            ),
          )
          .orderBy(desc(integrationConnections.updatedAt));
      },
      async resolveEnabled(providerCode, requestedId) {
        const conditions = [
          eq(integrationConnections.providerCode, providerCode),
          eq(integrationConnections.enabled, true),
        ];
        if (requestedId) conditions.push(eq(integrationConnections.id, requestedId));
        const [connection] = await database
          .select({
            id: integrationConnections.id,
            providerCode: integrationConnections.providerCode,
            name: integrationConnections.name,
          })
          .from(integrationConnections)
          .where(and(...conditions))
          .orderBy(desc(integrationConnections.updatedAt))
          .limit(1);
        return connection ?? null;
      },
      search(query, limit) {
        const pattern = `%${query}%`;
        return database
          .select({
            id: integrationConnections.id,
            providerCode: integrationConnections.providerCode,
            name: integrationConnections.name,
            enabled: integrationConnections.enabled,
          })
          .from(integrationConnections)
          .where(
            or(
              ilike(integrationConnections.name, pattern),
              ilike(integrationConnections.providerCode, pattern),
            ),
          )
          .limit(limit);
      },
    },
  };
}

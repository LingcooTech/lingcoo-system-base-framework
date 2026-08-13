import type { AuditCommandPort, AuditEvent } from '@lingcootech/frame-audit';

export type IntegrationsAuditEvent = AuditEvent;
export type IntegrationsAuditPort = AuditCommandPort;

export interface IntegrationConnectionSummary {
  id: string;
  providerCode: string;
  name: string;
}

export interface IntegrationConnectionSearchResult extends IntegrationConnectionSummary {
  enabled: boolean;
}

export interface IntegrationConnectionsPort {
  listEnabled(providerCode: string): Promise<readonly IntegrationConnectionSummary[]>;
  resolveEnabled(
    providerCode: string,
    requestedId?: string,
  ): Promise<IntegrationConnectionSummary | null>;
  search(query: string, limit: number): Promise<readonly IntegrationConnectionSearchResult[]>;
}

export interface IntegrationsPorts {
  audit: IntegrationsAuditPort;
  connections: IntegrationConnectionsPort;
}

export function createNoopIntegrationsPorts(): IntegrationsPorts {
  return {
    audit: { async record() {} },
    connections: {
      async listEnabled() {
        return [];
      },
      async resolveEnabled() {
        return null;
      },
      async search() {
        return [];
      },
    },
  };
}

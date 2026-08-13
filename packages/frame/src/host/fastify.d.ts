import '@fastify/cookie';
import '@fastify/jwt';

import type { Database } from '@lingcootech/frame-database';
import type { AuditCommandPort } from '@lingcootech/frame-audit';
import type { DefinedSystem } from '@lingcootech/frame-extension-sdk';
import type { ServerCapabilityRegistry } from '../runtime/capabilities.js';
import type { DatasetRegistry } from '../core/modules/data-exchange/registry.js';
import type { ObservabilityService } from '../core/modules/observability/service.js';
import type { PublicSiteRegistry } from '../core/modules/public-site/registry.js';
import type { SearchProviderRegistry } from '../core/modules/search/registry.js';
import type { SettingsRegistry } from '../core/modules/settings/registry.js';
import type { AppEnv } from './env.js';
import type { SystemEnvironmentRegistry } from '../runtime/environment.js';
import type { SecurityPrincipal, SecurityRuntime } from './security.js';

declare module 'fastify' {
  interface FastifyInstance {
    appEnv: AppEnv;
    frameSystem: DefinedSystem;
    capabilities: ServerCapabilityRegistry;
    environment: SystemEnvironmentRegistry;
    db: Database;
    auditCommands: AuditCommandPort;
    searchRegistry: SearchProviderRegistry;
    datasetRegistry: DatasetRegistry;
    observability: ObservabilityService;
    publicSiteRegistry: PublicSiteRegistry;
    settingsRegistry: SettingsRegistry;
    security: SecurityRuntime;
    authenticate: (request: import('fastify').FastifyRequest) => Promise<void>;
    requirePermission: (
      permission: string | string[],
    ) => (request: import('fastify').FastifyRequest) => Promise<void>;
  }

  interface FastifyRequest {
    metricsStartedAt: bigint | null;
    principal: SecurityPrincipal | null;
    auth: {
      accountId: string;
      sessionId: string;
      email: string;
      displayName: string;
      roleCodes: string[];
      permissions: string[];
    } | null;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      sid: string;
    };
    user: {
      sub: string;
      sid: string;
    };
  }
}

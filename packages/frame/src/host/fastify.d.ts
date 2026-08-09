import type { Database } from '@lingcootech/frame-database';
import type { DefinedSystem } from '@lingcootech/frame-extension-sdk';
import type { PermissionCode } from '../core/modules/access/rbac.js';
import type { DatasetRegistry } from '../core/modules/data-exchange/registry.js';
import type { ObservabilityService } from '../core/modules/observability/service.js';
import type { PublicSiteRegistry } from '../core/modules/public-site/registry.js';
import type { SearchProviderRegistry } from '../core/modules/search/registry.js';
import type { SettingsRegistry } from '../core/modules/settings/registry.js';
import type { AppEnv } from './env.js';

declare module 'fastify' {
  interface FastifyInstance {
    appEnv: AppEnv;
    frameSystem: DefinedSystem;
    db: Database;
    searchRegistry: SearchProviderRegistry;
    datasetRegistry: DatasetRegistry;
    observability: ObservabilityService;
    publicSiteRegistry: PublicSiteRegistry;
    settingsRegistry: SettingsRegistry;
    authenticate: (request: import('fastify').FastifyRequest) => Promise<void>;
    requirePermission: (
      permission: PermissionCode | PermissionCode[],
    ) => (request: import('fastify').FastifyRequest) => Promise<void>;
  }

  interface FastifyRequest {
    metricsStartedAt: bigint | null;
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

import type { Database } from '../db/client.js';
import type { AppEnv } from '../lib/env.js';
import type { PermissionCode } from '../lib/rbac.js';
import type { SearchProviderRegistry } from '../modules/search/registry.js';
import type { DatasetRegistry } from '../modules/data-exchange/registry.js';

declare module 'fastify' {
  interface FastifyInstance {
    appEnv: AppEnv;
    db: Database;
    searchRegistry: SearchProviderRegistry;
    datasetRegistry: DatasetRegistry;
    authenticate: (request: import('fastify').FastifyRequest) => Promise<void>;
    requirePermission: (
      permission: PermissionCode | PermissionCode[],
    ) => (request: import('fastify').FastifyRequest) => Promise<void>;
  }

  interface FastifyRequest {
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

import type { ExtensionEnvironmentValues } from '@lingcootech/frame-extension-sdk/environment';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export const SECURITY_PROVIDER_CAPABILITY = 'frame.security.provider';
export const SECURITY_PROVIDER_CAPABILITY_VERSION = '1.0.0';

export interface SecurityPrincipal {
  subject: string;
  type: string;
  accountId?: string;
  sessionId?: string;
  email?: string;
  displayName?: string;
  roleCodes: string[];
  permissions: string[];
  attributes?: Readonly<Record<string, unknown>>;
}

export interface SecurityProviderContext<TEnvironment = unknown> {
  app: FastifyInstance;
  env: TEnvironment;
  environment: ExtensionEnvironmentValues;
}

export interface SecurityRuntime {
  authenticate(request: FastifyRequest): Promise<SecurityPrincipal>;
  authorize(
    principal: SecurityPrincipal,
    requiredPermissions: readonly string[],
  ): boolean | Promise<boolean>;
  sensitiveValues?: readonly (string | undefined)[];
}

export interface SecurityProvider<TEnvironment = unknown> {
  install(
    context: SecurityProviderContext<TEnvironment>,
  ): SecurityRuntime | Promise<SecurityRuntime>;
}

export function createDenyAllSecurityProvider(): SecurityProvider {
  return {
    install({ app }) {
      return {
        async authenticate() {
          throw app.httpErrors.unauthorized('当前系统未安装身份认证扩展');
        },
        authorize() {
          return false;
        },
      };
    },
  };
}

declare module 'fastify' {
  interface FastifyInstance {
    security: SecurityRuntime;
    authenticate: (request: FastifyRequest) => Promise<void>;
    requirePermission: (
      permission: string | string[],
    ) => (request: FastifyRequest) => Promise<void>;
  }

  interface FastifyRequest {
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

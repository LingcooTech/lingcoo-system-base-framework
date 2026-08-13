import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import type { SecurityProvider } from '@lingcootech/frame-fastify/security';
import { hasAnyPermission } from './rbac.js';
import { DEFAULT_IDENTITY_ENVIRONMENT_ID, type DefaultIdentityEnvironment } from './environment.js';
import { AuthRepository } from './repository.js';
import { resolveIdentityDatabase } from './database.js';

function resolveJwtSecret(nodeEnv: string, configuredSecret?: string): string {
  if (configuredSecret) return configuredSecret;
  if (nodeEnv === 'production') {
    throw new Error('AUTH_JWT_SECRET is required in production');
  }
  return 'lingcoo-frame-development-jwt-secret-change-me';
}

function unauthorized(message: string): Error {
  return Object.assign(new Error(message), { name: 'UnauthorizedError', statusCode: 401 });
}

export function createCookieSessionSecurityProvider(
  environmentId: string = DEFAULT_IDENTITY_ENVIRONMENT_ID,
): SecurityProvider {
  return {
    async install({ app, environment }) {
      const identityEnvironment = environment.require<DefaultIdentityEnvironment>(environmentId);
      const jwtSecret = resolveJwtSecret(
        identityEnvironment.NODE_ENV,
        identityEnvironment.AUTH_JWT_SECRET,
      );
      await app.register(cookie);
      await app.register(jwt, {
        secret: jwtSecret,
        cookie: {
          cookieName: identityEnvironment.AUTH_COOKIE_NAME,
          signed: false,
        },
      });
      const repository = new AuthRepository(resolveIdentityDatabase(app));

      return {
        sensitiveValues: [jwtSecret, identityEnvironment.AUTH_BOOTSTRAP_PASSWORD],
        async authenticate(request) {
          try {
            await request.jwtVerify();
          } catch {
            throw unauthorized('登录已过期，请重新登录');
          }
          if (!request.user.sub || !request.user.sid) {
            throw unauthorized('登录凭证无效');
          }

          const resolved = await repository.resolveSession(request.user.sid, request.user.sub);
          if (!resolved) {
            throw unauthorized('登录已失效，请重新登录');
          }
          const access = await repository.getAccess(resolved.account.id);
          await repository.touchSession(resolved.session.id, resolved.session.lastSeenAt);
          return {
            subject: resolved.account.id,
            type: 'account',
            accountId: resolved.account.id,
            sessionId: resolved.session.id,
            email: resolved.account.email,
            displayName: resolved.account.displayName,
            roleCodes: access.roles.map((role) => role.code),
            permissions: access.permissions,
          };
        },
        authorize(principal, requiredPermissions) {
          return hasAnyPermission(principal.roleCodes, principal.permissions, requiredPermissions);
        },
      };
    },
  };
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; sid: string };
    user: { sub: string; sid: string };
  }
}

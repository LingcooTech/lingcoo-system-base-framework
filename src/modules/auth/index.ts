import type { FastifyReply } from 'fastify';

import type { AppModule } from '../types.js';
import { changePasswordSchema, loginSchema } from './schemas.js';
import { AuthService } from './service.js';

function sessionMetadata(request: { ip: string; headers: { 'user-agent'?: string } }) {
  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent']?.slice(0, 500),
  };
}

export const authModule: AppModule = {
  name: 'auth',
  async register(app) {
    const service = new AuthService(app.db);
    if (app.appEnv.AUTH_BOOTSTRAP_EMAIL && app.appEnv.AUTH_BOOTSTRAP_PASSWORD) {
      const created = await service.bootstrapOwner({
        email: app.appEnv.AUTH_BOOTSTRAP_EMAIL,
        password: app.appEnv.AUTH_BOOTSTRAP_PASSWORD,
        displayName: app.appEnv.AUTH_BOOTSTRAP_DISPLAY_NAME,
      });
      if (created) app.log.info('Bootstrap owner account created');
    }

    const cookieOptions = {
      path: '/',
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: app.appEnv.NODE_ENV === 'production',
      maxAge: app.appEnv.AUTH_SESSION_TTL_HOURS * 60 * 60,
    };

    function clearSessionCookie(reply: FastifyReply) {
      reply.clearCookie(app.appEnv.AUTH_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: app.appEnv.NODE_ENV === 'production',
      });
    }

    app.post(
      '/api/auth/login',
      {
        config: {
          rateLimit: {
            max: 8,
            timeWindow: '1 minute',
          },
        },
      },
      async (request, reply) => {
        const input = loginSchema.parse(request.body);
        const result = await service.login(
          input,
          sessionMetadata(request),
          app.appEnv.AUTH_SESSION_TTL_HOURS,
        );
        const token = await reply.jwtSign(
          { sub: result.account.id, sid: result.session.id },
          { expiresIn: app.appEnv.AUTH_SESSION_TTL_HOURS * 60 * 60 },
        );
        reply.setCookie(app.appEnv.AUTH_COOKIE_NAME, token, cookieOptions);
        return { account: result.account };
      },
    );

    app.post('/api/auth/logout', async (request, reply) => {
      try {
        await request.jwtVerify();
        if (request.user.sub && request.user.sid) {
          await service.logout(request.user.sub, request.user.sid);
        }
      } catch {
        // Logout remains idempotent even for an expired or malformed cookie.
      }
      clearSessionCookie(reply);
      return { ok: true };
    });

    app.get('/api/auth/me', { preHandler: app.authenticate }, async (request) => ({
      account: await service.getPublicAccount(request.auth!.accountId),
    }));

    app.post(
      '/api/auth/change-password',
      { preHandler: app.authenticate },
      async (request, reply) => {
        const input = changePasswordSchema.parse(request.body);
        await service.changePassword(request.auth!.accountId, request.auth!.sessionId, input);
        return reply.send({ ok: true });
      },
    );
  },
};

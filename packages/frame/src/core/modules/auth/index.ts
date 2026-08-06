import type { FastifyReply } from 'fastify';

import type { AppModule } from '../types.js';
import {
  changePasswordSchema,
  completeSecurityChallengeSchema,
  loginSchema,
  passwordResetRequestSchema,
  sessionParamsSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from './schemas.js';
import { AccountSecurityService } from './security.js';
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
    const security = new AccountSecurityService(
      app.db,
      app.appEnv.SETTINGS_ENCRYPTION_KEY,
      app.appEnv.NODE_ENV,
    );
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

    app.post(
      '/api/auth/password-reset/request',
      { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
      async (request, reply) => {
        await security.requestPasswordReset(
          passwordResetRequestSchema.parse(request.body).email,
          request.ip,
        );
        return reply.code(202).send({ ok: true });
      },
    );
    app.post(
      '/api/auth/password-reset/complete',
      { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } },
      async (request) => {
        const input = completeSecurityChallengeSchema.parse(request.body);
        await security.resetPassword(input.token, input.newPassword);
        return { ok: true };
      },
    );
    app.post(
      '/api/auth/invitations/accept',
      { config: { rateLimit: { max: 8, timeWindow: '15 minutes' } } },
      async (request) => {
        const input = completeSecurityChallengeSchema.parse(request.body);
        await security.acceptInvitation(input.token, input.newPassword);
        return { ok: true };
      },
    );
    app.post('/api/auth/email/verify', async (request) => {
      await security.verifyEmail(verifyEmailSchema.parse(request.body).token);
      return { ok: true };
    });
    app.post(
      '/api/account/email-verification',
      { preHandler: app.authenticate, config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
      async (request, reply) => {
        const queued = await security.requestEmailVerification(request.auth!.accountId, request.ip);
        return reply.code(queued ? 202 : 200).send({ ok: true, alreadyVerified: !queued });
      },
    );
    app.get('/api/account/profile', { preHandler: app.authenticate }, async (request) => ({
      profile: await security.getProfile(request.auth!.accountId),
    }));
    app.patch('/api/account/profile', { preHandler: app.authenticate }, async (request) => ({
      profile: await security.updateProfile(
        request.auth!.accountId,
        updateProfileSchema.parse(request.body),
      ),
    }));
    app.get('/api/account/sessions', { preHandler: app.authenticate }, async (request) => ({
      items: await security.listSessions(request.auth!.accountId, request.auth!.sessionId),
    }));
    app.delete(
      '/api/account/sessions/:sessionId',
      { preHandler: app.authenticate },
      async (request) => {
        await security.revokeSession(
          request.auth!.accountId,
          request.auth!.sessionId,
          sessionParamsSchema.parse(request.params).sessionId,
        );
        return { ok: true };
      },
    );
    app.post(
      '/api/account/sessions/revoke-others',
      { preHandler: app.authenticate },
      async (request) => ({
        count: await security.revokeOtherSessions(request.auth!.accountId, request.auth!.sessionId),
      }),
    );
    app.get('/api/account/security-events', { preHandler: app.authenticate }, async (request) => ({
      items: await security.securityEvents(request.auth!.accountId),
    }));
  },
};

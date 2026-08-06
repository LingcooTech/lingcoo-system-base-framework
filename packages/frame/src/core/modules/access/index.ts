import type { AppModule } from '../types.js';
import {
  accountParamsSchema,
  createAccountSchema,
  createRoleSchema,
  roleParamsSchema,
  updateAccountSchema,
  updateRoleSchema,
} from './schemas.js';
import { AccessService } from './service.js';

export const accessModule: AppModule = {
  name: 'access',
  register(app) {
    const service = new AccessService(
      app.db,
      app.appEnv.SETTINGS_ENCRYPTION_KEY,
      app.appEnv.NODE_ENV,
    );

    app.get(
      '/api/access/accounts',
      { preHandler: app.requirePermission('iam.accounts.read') },
      async () => ({ items: await service.listAccounts() }),
    );

    app.post(
      '/api/access/accounts',
      { preHandler: app.requirePermission('iam.accounts.write') },
      async (request, reply) => {
        const account = await service.createAccount(
          createAccountSchema.parse(request.body),
          request.auth!.accountId,
        );
        return reply.code(201).send({ account });
      },
    );

    app.patch(
      '/api/access/accounts/:accountId',
      { preHandler: app.requirePermission('iam.accounts.write') },
      async (request) => {
        const { accountId } = accountParamsSchema.parse(request.params);
        const account = await service.updateAccount(
          accountId,
          updateAccountSchema.parse(request.body),
          request.auth!.accountId,
        );
        return { account };
      },
    );

    app.post(
      '/api/access/accounts/:accountId/invitation',
      { preHandler: app.requirePermission('iam.accounts.write') },
      async (request, reply) => {
        const { accountId } = accountParamsSchema.parse(request.params);
        await service.resendInvitation(accountId, request.auth!.accountId);
        return reply.code(202).send({ ok: true });
      },
    );

    app.get(
      '/api/access/roles',
      { preHandler: app.requirePermission('iam.roles.read') },
      async () => ({ items: await service.listRoles() }),
    );

    app.get(
      '/api/access/permissions',
      { preHandler: app.requirePermission('iam.roles.read') },
      async () => ({ items: await service.listPermissions() }),
    );

    app.post(
      '/api/access/roles',
      { preHandler: app.requirePermission('iam.roles.write') },
      async (request, reply) => {
        const roleId = await service.createRole(
          createRoleSchema.parse(request.body),
          request.auth!.accountId,
        );
        return reply.code(201).send({ roleId });
      },
    );

    app.patch(
      '/api/access/roles/:roleId',
      { preHandler: app.requirePermission('iam.roles.write') },
      async (request) => {
        const { roleId } = roleParamsSchema.parse(request.params);
        await service.updateRole(
          roleId,
          updateRoleSchema.parse(request.body),
          request.auth!.accountId,
        );
        return { ok: true };
      },
    );
  },
};

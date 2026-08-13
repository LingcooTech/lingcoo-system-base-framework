import type { FastifyInstance } from 'fastify';
import {
  accountParamsSchema,
  createAccountSchema,
  createRoleSchema,
  roleParamsSchema,
  updateAccountSchema,
  updateRoleSchema,
} from './access-schemas.js';
import { AccessService } from './access-service.js';
import { resolveIdentityDatabase } from './database.js';
import { createNoopIdentityPorts, type IdentityPorts } from './ports.js';

export interface RegisterIdentityAccessRoutesOptions {
  ports?: IdentityPorts;
}

export function registerIdentityAccessRoutes(
  app: FastifyInstance,
  options: RegisterIdentityAccessRoutesOptions = {},
): void {
  const service = new AccessService(
    resolveIdentityDatabase(app),
    options.ports ?? createNoopIdentityPorts(),
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
}

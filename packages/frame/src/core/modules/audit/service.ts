import type { AuditQuery, AuditQueryPort, AuditRecord } from '@lingcootech/frame-audit';
import type { IdentityAccountDirectoryPort } from '@lingcootech/frame-identity';
import { httpError } from '../../../host/http-error.js';

export type AuditFilters = AuditQuery;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AuditService {
  constructor(
    private readonly queries: AuditQueryPort,
    private readonly accounts: IdentityAccountDirectoryPort,
  ) {}

  async list(filters: AuditFilters) {
    const page = await this.queries.list(filters);
    return { ...page, items: await this.withActors(page.items) };
  }

  async get(auditId: string) {
    const item = await this.queries.findById(auditId);
    if (!item) throw httpError(404, '审计记录不存在', 'NotFoundError');
    return (await this.withActors([item]))[0];
  }

  private async withActors(records: AuditRecord[]) {
    const actorIds = records.flatMap((record) =>
      record.actorId && UUID_PATTERN.test(record.actorId) ? [record.actorId] : [],
    );
    const actors = new Map(
      (await this.accounts.findByIds(actorIds)).map((account) => [account.id, account]),
    );
    return records.map((record) => ({
      ...record,
      actor: record.actorId
        ? ((account) =>
            account
              ? { id: account.id, email: account.email, displayName: account.displayName }
              : null)(actors.get(record.actorId))
        : null,
    }));
  }
}

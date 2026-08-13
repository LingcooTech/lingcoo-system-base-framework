import { eq, ilike, inArray, or } from 'drizzle-orm';

import type { Database } from '@lingcootech/frame-database';
import { accounts } from '@lingcootech/frame-database/schema';
import type { IdentityAccountDirectoryPort, IdentityAccountSummary } from './account-directory.js';

const accountSummary = {
  id: accounts.id,
  email: accounts.email,
  displayName: accounts.displayName,
  status: accounts.status,
};

export class PostgresIdentityAccountDirectory implements IdentityAccountDirectoryPort {
  readonly configured = true;

  constructor(private readonly database: Database) {}

  async findById(accountId: string): Promise<IdentityAccountSummary | null> {
    const [account] = await this.database
      .select(accountSummary)
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);
    return account ?? null;
  }

  async findByIds(accountIds: readonly string[]): Promise<readonly IdentityAccountSummary[]> {
    const uniqueIds = [...new Set(accountIds)];
    if (!uniqueIds.length) return [];
    return this.database
      .select(accountSummary)
      .from(accounts)
      .where(inArray(accounts.id, uniqueIds));
  }

  listActive(): Promise<readonly IdentityAccountSummary[]> {
    return this.database.select(accountSummary).from(accounts).where(eq(accounts.status, 'active'));
  }

  search(query: string, limit: number): Promise<readonly IdentityAccountSummary[]> {
    const pattern = `%${query}%`;
    return this.database
      .select(accountSummary)
      .from(accounts)
      .where(or(ilike(accounts.email, pattern), ilike(accounts.displayName, pattern)))
      .limit(limit);
  }

  async findMatchingIds(query: string): Promise<readonly string[]> {
    const pattern = `%${query}%`;
    const rows = await this.database
      .select({ id: accounts.id })
      .from(accounts)
      .where(or(ilike(accounts.email, pattern), ilike(accounts.displayName, pattern)));
    return rows.map((row) => row.id);
  }
}

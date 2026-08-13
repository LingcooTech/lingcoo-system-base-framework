export interface IdentityAccountSummary {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

export interface IdentityAccountDirectoryPort {
  readonly configured: boolean;
  findById(accountId: string): Promise<IdentityAccountSummary | null>;
  findByIds(accountIds: readonly string[]): Promise<readonly IdentityAccountSummary[]>;
  listActive(): Promise<readonly IdentityAccountSummary[]>;
  search(query: string, limit: number): Promise<readonly IdentityAccountSummary[]>;
  findMatchingIds(query: string): Promise<readonly string[]>;
}

export function createNoopIdentityAccountDirectory(): IdentityAccountDirectoryPort {
  return {
    configured: false,
    async findById() {
      return null;
    },
    async findByIds() {
      return [];
    },
    async listActive() {
      return [];
    },
    async search() {
      return [];
    },
    async findMatchingIds() {
      return [];
    },
  };
}

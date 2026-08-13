export interface DatabaseConnectionOptions {
  connectionString: string;
}

export interface DatabaseConnection<TClient = unknown> {
  readonly client: TClient;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export interface DatabaseAdapter<TClient = unknown> {
  readonly id: string;
  connect(
    options: DatabaseConnectionOptions,
  ): DatabaseConnection<TClient> | Promise<DatabaseConnection<TClient>>;
}

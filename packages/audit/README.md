# @lingcootech/frame-audit

Provider-neutral audit write/query contracts with an optional PostgreSQL/Drizzle adapter.

- The root export contains `AuditCommandPort`, `AuditQueryPort`, event/read models and no-op ports.
- `@lingcootech/frame-audit/postgres` contains `PostgresAuditCommandPort` and
  `PostgresAuditQueryPort`.
- Request context and actor enrichment belong to the consuming Host composition root.

Provider-neutral audit command contract with an optional PostgreSQL adapter.
Request context is supplied by the Host through an `AuditContextProvider`; the
Audit package does not depend on Fastify or process-local context storage.

# Contributing to Lingcoo Frame

Thank you for helping improve Frame. Small, focused changes with tests and a clear compatibility story are easiest to
review.

## Before opening a change

1. Use an issue to discuss new public APIs, schema changes, large refactors, or changes to extension contracts.
2. Do not include customer code, customer data, credentials, private product logic, or third-party material you cannot
   redistribute.
3. Keep browser packages free of server, database, migration, and secret-handling code.
4. Treat published migration IDs, SQL contents, checksums, export paths, and Extension Manifest contracts as immutable.

## Development

Frame requires Node.js 22+, PostgreSQL 17+, npm, and Docker for the complete verification path.

```bash
npm ci
npm run build:packages
npm run db:migrate
npm run check
npm run packages:verify
```

Use `npm run format` before submitting when files need formatting. A publishable package change must include a
Changeset:

```bash
npm run changeset
```

Document breaking changes, configuration changes, and migrations. New behavior should include tests at the narrowest
useful level; package-boundary changes must also pass the isolated tarball Consumer verification.

## Pull requests

- Explain the problem and the chosen boundary, not only the edited files.
- Link related issues and describe verification performed.
- Keep all eight official Frame packages on the repository's fixed compatibility version.
- Expect maintainers to request changes when a contribution expands Core with product-specific behavior.

Unless explicitly stated otherwise, intentionally submitted contributions are licensed under Apache-2.0 as described
in section 5 of the license. Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

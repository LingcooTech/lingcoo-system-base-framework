# **DISPLAY_NAME**

Independent application built on `@lingcootech/frame` **FRAME_VERSION**. Frame source code is not
copied into this repository.

## Local development

1. Copy `.env.example` to `.env`; set one database password in both `POSTGRES_PASSWORD` and
   `DATABASE_URL`, generate unique 32+ character auth/encryption secrets, and provide temporary
   bootstrap credentials only when creating the first owner.
2. When using GitHub Packages, export a token with `read:packages` as `NODE_AUTH_TOKEN`.
3. Run `docker compose up -d postgres`, `npm install`, and `npm run db:migrate`.
4. Start API, worker, admin, and web with the `dev:*` scripts.

Run `npm run frame:verify` before every commit. Upgrade all Frame packages together with:

```bash
npm run frame:upgrade -- <exact-version>
```

The upgrade command edits dependency declarations and the lockfile; it never migrates a production
database or creates a Git commit.

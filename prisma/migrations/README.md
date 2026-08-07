# Migrations

`0_init` is the **baseline migration**: it reproduces the entire schema (38 models) from an
empty database. It was generated with
`prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`
and verified by deploying it to a clean PostgreSQL 15 database:

- `prisma migrate deploy` → applied cleanly
- `prisma migrate status` → *"Database schema is up to date!"*
- 39 tables (38 models + `_prisma_migrations`), 28 foreign keys, 75 indexes
- drift check (`migrate diff --from-url <db> --to-schema-datamodel`) → **empty migration = zero drift**

## New / local environments

```bash
npx prisma migrate deploy
npx prisma db seed
```

## ⚠️ Existing environments created with `db push` (production today)

The deployed database already contains these tables but has **no `_prisma_migrations`
history**. Running `migrate deploy` against it will try to re-create existing tables and fail.

It must be **baselined once** — this records the migration as already applied without
executing any SQL:

```bash
# one time, against the existing database
npx prisma migrate resolve --applied 0_init
npx prisma migrate status   # expect: Database schema is up to date!
```

Only **after** that one-time baseline should CI be switched from
`npx prisma db push --skip-generate` to `npx prisma migrate deploy`
(`.github/workflows/deploy.yml`). `db push` is unsafe for production: it can silently drop or
rewrite columns to force the schema to match, with no migration history and no review step.

**Status:** the CI switch is intentionally *not* included in this commit because the one-time
baseline requires access to the production database, which the audit environment does not have.
See `qa/REMAINING_TASKS.md` → T-01 follow-up.

## Adding a change from here on

```bash
npx prisma migrate dev --name <describe_the_change>
```
Commit the generated folder. Never edit an applied migration.

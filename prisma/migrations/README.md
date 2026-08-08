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

It must be **baselined once** — this records the migrations as already applied without
executing any SQL:

```bash
# one time, against the existing database, in this order
npx prisma migrate resolve --applied 0_init
npx prisma migrate resolve --applied 20260807211405_donation_case_project_links
npx prisma migrate status   # expect: Database schema is up to date!
```

> **Every migration in `prisma/migrations/` must be resolved, not just `0_init`.** This runbook
> originally named the baseline alone, because it was the only migration at the time.
> `20260807211405_donation_case_project_links` landed with T-20 and reached production through
> `db push` like everything else, so it needs recording too. Anything added later does as well —
> `scripts/apply-schema.js` prints the current list, so use its output rather than this one.

## The deploy no longer uses `db push`

`.github/workflows/deploy.yml` runs **`node scripts/apply-schema.js`**, which reads the database
and decides:

| State | Action |
|---|---|
| `_prisma_migrations` exists | `prisma migrate deploy` — the normal path |
| No migrations table, no tables | `prisma migrate deploy` — a fresh database applies the baseline |
| No migrations table, tables present | **Stops.** Prints the commands above and exits non-zero **without changing the schema** |

The third row is production today. Failing the deploy there is deliberate: a deploy that cannot
apply its schema must not go on to restart the application, and it must certainly not fall back to
`db push`.

Verified on throwaway clusters in `test/integration/apply-schema.int-spec.ts`, including reproducing
the P3005 failure that a naive switch to `migrate deploy` would have shipped.

**Status:** the workflow is switched. The one-time baseline still requires access to the production
database — until it is run, deploys will stop at the schema step with the instructions above,
having changed nothing.
See `qa/REMAINING_TASKS.md` → T-01 follow-up.

## Adding a change from here on

```bash
npx prisma migrate dev --name <describe_the_change>
```
Commit the generated folder. Never edit an applied migration.

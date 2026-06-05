---
title: Prisma
description: The @branchly/migrator-prisma adapter — fingerprinting and applying Prisma migrations.
---

`@branchly/migrator-prisma` drives [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate): it fingerprints your migration set, applies pending migrations with `prisma migrate deploy`, and runs your seed command on fresh databases.

## Configuration

```ts
migrator: {
  use: 'prisma',
}
```

| Option          | Default                       | Meaning                                                           |
| --------------- | ----------------------------- | ----------------------------------------------------------------- |
| `migrationsDir` | `'prisma/migrations'`         | Where your migration folders live.                                |
| `seed`          | _(none)_                      | Seed command (e.g. `'tsx prisma/seed.ts'`). Skipped when unset.   |
| `applyCommand`  | `'npx prisma migrate deploy'` | The command used to apply pending migrations.                     |
| `urlEnv`        | `'DATABASE_URL'`              | The env var the apply/seed commands receive the connection under. |

## Behavior

- **Fingerprint** — a hash of the migration directory names under `migrationsDir`. Add or remove a migration and the fingerprint changes; branches with identical migration sets share snapshots.
- **Apply** — `prisma migrate deploy`, which is exactly the idempotent, pending-only application the [kernel relies on](/branchly/guides/how-it-works/#the-provisioning-algorithm). No shadow database, no resets, no prompts.
- **Seed** — your configured command, run with the branch connection injected as `urlEnv`. Only runs on databases built from empty; clones already carry seed data.

Works with any of the datasource adapters — PostgreSQL, MySQL, or SQLite.

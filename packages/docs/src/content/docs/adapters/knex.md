---
title: Knex
description: The @branchly/migrator-knex adapter — fingerprinting and applying Knex migrations.
---

`@branchly/migrator-knex` drives [Knex migrations](https://knexjs.org/guide/migrations.html): it fingerprints your migration files, applies them with `knex migrate:latest`, and runs your seed command on fresh databases.

## Configuration

```ts
migrator: {
  use: 'knex',
}
```

| Option          | Default                     | Meaning                                                                         |
| --------------- | --------------------------- | ------------------------------------------------------------------------------- |
| `migrationsDir` | `'migrations'`              | Where your migration files live (`.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, `.mts`). |
| `seed`          | _(none)_                    | Seed command (e.g. `'npx knex seed:run'`). Skipped when unset.                  |
| `applyCommand`  | `'npx knex migrate:latest'` | The command used to apply pending migrations.                                   |
| `urlEnv`        | `'DATABASE_URL'`            | The env var the apply/seed commands receive the connection under.               |

## Behavior

- **Fingerprint** — a hash of the migration file names in `migrationsDir`. Branches with identical migration sets share snapshots.
- **Apply** — `knex migrate:latest` runs only pending migrations, satisfying the kernel's idempotency requirement. Your `knexfile` should read its connection from `urlEnv` (the common `process.env.DATABASE_URL` pattern).
- **Seed** — your configured command (typically `npx knex seed:run`), run with the branch connection injected as `urlEnv`, on freshly built databases only.

`branchly init` recognizes every `knexfile` flavor — `.js`, `.cjs`, `.mjs`, `.ts`, `.cts`, `.mts` — for both migrator and datasource detection. Works with any of the datasource adapters.

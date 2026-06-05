---
title: Drizzle
description: The @branchly/migrator-drizzle adapter — fingerprinting and applying Drizzle migrations.
---

`@branchly/migrator-drizzle` drives [Drizzle Kit](https://orm.drizzle.team/docs/kit-overview): it fingerprints your generated SQL migrations, applies them with `drizzle-kit migrate`, and runs your seed command on fresh databases.

## Configuration

```ts
migrator: {
  use: 'drizzle',
}
```

| Option          | Default                     | Meaning                                                           |
| --------------- | --------------------------- | ----------------------------------------------------------------- |
| `migrationsDir` | `'drizzle'`                 | Where your generated `.sql` migrations live.                      |
| `seed`          | _(none)_                    | Seed command (e.g. `'tsx src/seed.ts'`). Skipped when unset.      |
| `applyCommand`  | `'npx drizzle-kit migrate'` | The command used to apply pending migrations.                     |
| `urlEnv`        | `'DATABASE_URL'`            | The env var the apply/seed commands receive the connection under. |

## Behavior

- **Fingerprint** — a hash of the `.sql` file names in `migrationsDir`. Branches with identical migration sets share snapshots.
- **Apply** — `drizzle-kit migrate` applies only pending migrations, satisfying the kernel's idempotency requirement.
- **Seed** — your configured command, run with the branch connection injected as `urlEnv`, on freshly built databases only.

Works with any of the datasource adapters — PostgreSQL, MySQL, or SQLite.

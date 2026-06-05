---
title: Adapters overview
description: The first-party adapters that ship with branchly, and how adapter selection works.
---

branchly grows by adapters. Each one is a small, self-contained package implementing exactly one axis, and any migrator works with any datasource — that's the whole point of the [four-axis model](/branchly/guides/how-it-works/#the-four-axes).

## First-party adapters

| Axis       | Adapter                                    | Package                         | Notes                                          |
| ---------- | ------------------------------------------ | ------------------------------- | ---------------------------------------------- |
| Datasource | [PostgreSQL](/branchly/adapters/postgres/) | `@branchly/datasource-postgres` | Instant clone via `CREATE DATABASE … TEMPLATE` |
| Datasource | [MySQL](/branchly/adapters/mysql/)         | `@branchly/datasource-mysql`    | SQL-level cloning, FK- and view-aware          |
| Datasource | [SQLite](/branchly/adapters/sqlite/)       | `@branchly/datasource-sqlite`   | File per branch; clone = file copy             |
| Migrator   | [Prisma](/branchly/adapters/prisma/)       | `@branchly/migrator-prisma`     | `prisma migrate deploy`                        |
| Migrator   | [Drizzle](/branchly/adapters/drizzle/)     | `@branchly/migrator-drizzle`    | `drizzle-kit migrate`                          |
| Migrator   | [Knex](/branchly/adapters/knex/)           | `@branchly/migrator-knex`       | `knex migrate:latest`                          |
| Resolver   | [env file](/branchly/adapters/env-file/)   | `@branchly/resolver-env-file`   | Upserts the key into `.env`                    |
| Resolver   | [direnv](/branchly/adapters/direnv/)       | `@branchly/resolver-direnv`     | Upserts an `export` line into `.envrc`         |
| VCS        | Git                                        | `@branchly/vcs-git`             | The default and (so far) only VCS adapter      |

`branchly init` detects which of these your project needs and installs them for you.

## Selecting an adapter

Short aliases resolve by convention — `use: 'postgres'` means `@branchly/datasource-postgres`:

```ts
export default defineConfig({
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres', url: env('DATABASE_URL'), prefix: 'app' },
  resolver: { use: 'env-file', file: '.env', key: 'DATABASE_URL' },
});
```

Anything containing `@` or `/` is treated as a fully-qualified package name, so third-party adapters drop straight in:

```ts
export default defineConfig({
  migrator: { use: '@yourorg/branchly-migrator-flyway' },
});
```

All other keys in the block are handed to the adapter as options — each adapter page documents its own.

## Missing your stack?

Adapters are deliberately small (the SQLite datasource is well under a hundred lines), and the [conformance test kit](/branchly/authoring/test-kit/) tells you when yours is correct. The [authoring guide](/branchly/authoring/overview/) walks through it — contributions are very welcome!

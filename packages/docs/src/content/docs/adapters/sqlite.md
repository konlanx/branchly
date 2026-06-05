---
title: SQLite
description: The @branchly/datasource-sqlite adapter — a database file per branch, no server required.
---

`@branchly/datasource-sqlite` keeps one SQLite file per branch under a local directory. No server, no credentials, no admin connection — the simplest possible datasource, and a lovely fit for SQLite-based projects.

| Capability          | Value | Via                     |
| ------------------- | :---: | ----------------------- |
| `instantClone`      |  ✅   | A file copy             |
| `snapshot`          |  ✅   | Snapshots are files too |
| `isolatedPerBranch` |  ✅   | One file per branch     |

## Configuration

```ts
datasource: {
  use: 'sqlite',
}
```

| Option | Default              | Meaning                                         |
| ------ | -------------------- | ----------------------------------------------- |
| `dir`  | `'.branchly/sqlite'` | Directory where per-branch database files live. |

Connections resolve to `file:` URLs pointing at `<dir>/<key>.sqlite`, which Prisma, Drizzle, and Knex all understand. The directory is created on demand and sits inside `.branchly/`, which `init` already gitignores.

## How cloning works

`clone` is `copyFile`. Snapshots are copies too. It's hard to overstate how well SQLite's one-file-one-database model fits branch-per-database — switching branches is quite literally pointing at a different file.

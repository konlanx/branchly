---
title: MySQL
description: The @branchly/datasource-mysql adapter — per-branch databases with SQL-level cloning.
---

`@branchly/datasource-mysql` gives each branch its own database (schema) on your MySQL server, named `<prefix>_<key>`.

| Capability          | Value | Via                              |
| ------------------- | :---: | -------------------------------- |
| `instantClone`      |  ✅   | SQL-level replay (see below)     |
| `snapshot`          |  ✅   | Snapshots are ordinary databases |
| `isolatedPerBranch` |  ✅   | One database per branch          |

## Configuration

```ts
datasource: {
  use: 'mysql',
  url: env('DATABASE_URL'),
  prefix: 'app',
}
```

| Option   | Default      | Meaning                                                                                 |
| -------- | ------------ | --------------------------------------------------------------------------------------- |
| `url`    | _(required)_ | Your existing connection string. branchly keeps host + credentials, swaps the database. |
| `prefix` | `'app'`      | Database name prefix; everything branchly creates starts with `<prefix>_`.              |

## How cloning works

MySQL has no template mechanism, so this adapter clones at the SQL level:

1. Replays each table's `SHOW CREATE TABLE` definition into the target database.
2. Copies data with `INSERT … SELECT`, with foreign-key checks disabled during the copy so table order doesn't matter.
3. Recreates views against the target schema, retrying in dependency order so views-on-views resolve.

For development-sized databases this is fast — not Postgres-template fast, but easily quick enough that branch switches stay pleasant. The result is a fully independent database: writes to the clone never touch the source (the conformance kit verifies exactly this).

## Requirements

The connection's user must be able to `CREATE DATABASE`, `DROP DATABASE`, and read `information_schema` — standard for a development root or admin user.

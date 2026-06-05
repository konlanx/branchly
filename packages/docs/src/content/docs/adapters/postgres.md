---
title: PostgreSQL
description: The @branchly/datasource-postgres adapter — per-branch databases with template-based instant cloning.
---

`@branchly/datasource-postgres` gives each branch its own database on your PostgreSQL server, named `<prefix>_<key>` (e.g. `app_feature_login__a1b2c3d4e5f6a7b8`).

| Capability          | Value | Via                              |
| ------------------- | :---: | -------------------------------- |
| `instantClone`      |  ✅   | `CREATE DATABASE … TEMPLATE`     |
| `snapshot`          |  ✅   | Snapshots are template databases |
| `isolatedPerBranch` |  ✅   | One database per branch          |

## Configuration

```ts
datasource: {
  use: 'postgres',
  url: env('DATABASE_URL'),
  prefix: 'app',
}
```

| Option                | Default      | Meaning                                                                                 |
| --------------------- | ------------ | --------------------------------------------------------------------------------------- |
| `url`                 | _(required)_ | Your existing connection string. branchly keeps host + credentials, swaps the database. |
| `prefix`              | `'app'`      | Database name prefix; everything branchly creates starts with `<prefix>_`.              |
| `maintenanceDatabase` | `'postgres'` | The database used for administrative statements like `CREATE DATABASE`.                 |

## How cloning works

PostgreSQL's template mechanism copies a database at the file level — `CREATE DATABASE new TEMPLATE source` typically completes in well under a second for development-sized databases. branchly uses it both for branch-to-branch clones and for the [snapshot cache](/branchly/guides/cache/).

One PostgreSQL quirk to know: a database can't be used as a template while it has other active connections. branchly handles its own connections carefully, but if a clone fails with a "source database is being accessed by other users" error, close stray connections (a `psql` session, a running app) to the source branch's database and retry — the error message will say exactly that.

## Requirements

The connection's role must be allowed to `CREATE DATABASE` (the `CREATEDB` privilege — true for the default development superuser). Database names are validated against PostgreSQL's 63-character limit; the slug cap and fingerprint length are designed to fit comfortably under it with the default prefix.

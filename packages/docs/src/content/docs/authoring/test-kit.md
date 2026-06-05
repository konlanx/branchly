---
title: The conformance test kit
description: '@branchly/adapter-test-kit — executable contracts for datasources, migrators, and resolvers.'
---

`@branchly/adapter-test-kit` is the adapter contract, written as tests. For an extensibility-first tool the kit matters as much as the adapters themselves: it's what makes "passes the kit" mean "works with branchly". Every first-party adapter runs it; yours should too.

```sh
npm install --save-dev @branchly/adapter-test-kit vitest
```

The kit exports three `describe*` functions — one per axis — that you call from a [Vitest](https://vitest.dev/) test file. Each takes a `label` and a `create` function returning a fresh fixture per test, with a `cleanup` the kit always runs, pass or fail.

## Testing a datasource

```ts
import { describeDatasourceAdapter } from '@branchly/adapter-test-kit';

import { createMyDatasource } from './index';

describeDatasourceAdapter({
  label: 'my-datasource',
  create: async () => {
    const datasource = createMyDatasource({ url: process.env.MY_TEST_URL ?? 'postgres://localhost/test' });
    return {
      datasource,
      probe: {
        write: async (connection, marker) => writeMarkerRow(connection, marker),
        read: async (connection) => readMarkerRow(connection),
      },
      cleanup: async () => dropEverythingCreated(datasource),
    };
  },
});
```

What it verifies:

| Invariant                                                           | Catches                                           |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `create(k)` then `exists(k)` is `true`                              | broken existence checks                           |
| `destroy(k)` then `exists(k)` is `false`                            | lingering databases                               |
| `resolve(k)` is deterministic across calls                          | impure resolution                                 |
| `list()` includes created, excludes destroyed keys                  | inaccurate inventories (prune relies on this)     |
| after `clone(a, b)`, both exist — and writes to `b` don't touch `a` | shallow copies and shared state — **the big one** |
| with `instantClone: false`, `clone` rejects                         | accidentally-advertised capabilities              |

The **`probe`** is how the kit checks true clone isolation: `write` puts a marker in a database via its connection string, `read` retrieves it. The kit writes `original` to the source, clones, writes `changed` to the clone, and expects the source still reads `original`. It's optional — clone-capable adapters should absolutely provide one, since isolation is their whole value.

## Testing a migrator

```ts
import { describeMigratorAdapter } from '@branchly/adapter-test-kit';

import { createMyMigrator } from './index';

describeMigratorAdapter({
  label: 'my-migrator',
  create: async () => {
    const project = await scaffoldTempProjectWithTwoMigrations();
    return {
      migrator: createMyMigrator({ cwd: project.dir }),
      altMigrator: createMyMigrator({ cwd: project.dirWithOneExtraMigration }),
      connection: project.databaseUrl,
      cleanup: project.remove,
    };
  },
});
```

What it verifies:

| Invariant                                             | Catches                                      |
| ----------------------------------------------------- | -------------------------------------------- |
| `fingerprint()` is deterministic                      | timestamps or randomness leaking in          |
| `fingerprint()` differs for a different migration set | insensitive fingerprints (stale caches!)     |
| `apply` twice in a row succeeds                       | non-idempotent application — **the big one** |
| `seed` succeeds after `apply`                         | seeds that assume more than a migrated DB    |

The **`altMigrator`** is the same adapter pointed at a migration set that differs by one migration — that's how the kit checks fingerprint sensitivity. It's optional but strongly recommended.

## Testing a resolver

```ts
import { describeResolverAdapter } from '@branchly/adapter-test-kit';

import { createMyResolver } from './index';

describeResolverAdapter({
  label: 'my-resolver',
  create: async () => {
    const dir = await makeTempDir();
    return {
      resolver: createMyResolver({ cwd: dir }),
      observe: () => readConnectionTheWayAnAppWould(dir),
      cleanup: () => removeTempDir(dir),
    };
  },
});
```

What it verifies: after `inject(conn)`, your `observe` function — which should read the connection back the way a real app would — sees `conn`; and a second `inject` overwrites the first.

## Fakes for testing around adapters

The kit also ships two fakes so you can test kernel-adjacent logic without a real database:

- **`createInMemoryDatasource({ instantClone?, snapshot? })`** — a Map-backed datasource exposing its `store`, with toggleable capabilities. Handy for testing how your code behaves on datasources with different capability sets.
- **`createTrivialMigrator({ fingerprint? })`** — a no-op migrator with a fixed fingerprint.

```ts
import { createInMemoryDatasource, createTrivialMigrator } from '@branchly/adapter-test-kit';

const datasource = createInMemoryDatasource({ instantClone: false });
const migrator = createTrivialMigrator({ fingerprint: 'fp1' });
```

These are the same fakes branchly's own kernel tests run against.

## CI tips

- Adapters needing a real server (Postgres, MySQL) should read their connection from an env var and **auto-skip when it's unset** — first-party adapters use `BRANCHLY_TEST_PG_URL` / `BRANCHLY_TEST_MYSQL_URL`, set in CI by service containers, skipped locally.
- File-based adapters (SQLite, env-file, direnv) need no infrastructure — run them everywhere.
- Create everything under a unique temp prefix and clean up in `cleanup`; the kit calls it even when an assertion fails.

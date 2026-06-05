---
title: Writing a datasource
description: Implementing DatasourceAdapter — create, clone, address, and destroy databases for a new backend.
---

A datasource answers one question for the kernel: _how do I create, clone, address, and destroy a database here?_ If you can do those four things against your backend, branchly can do everything else.

## The interface

```ts
interface DatasourceAdapter {
  readonly id: string;
  readonly apiVersion: number;
  readonly capabilities: Capabilities;

  resolve(key: BranchKey): ConnectionString;

  exists(key: BranchKey): Promise<boolean>;
  list(): Promise<BranchKey[]>;

  create(key: BranchKey): Promise<void>;
  clone(from: BranchKey, to: BranchKey): Promise<void>;
  destroy(key: BranchKey): Promise<void>;
}

interface Capabilities {
  readonly instantClone: boolean;
  readonly snapshot: boolean;
  readonly isolatedPerBranch: boolean;
}
```

A `BranchKey` is an opaque string like `feature_login__a1b2c3d4e5f6a7b8` — already lowercased, identifier-safe (`[a-z0-9_]`), and length-bounded. Your job is to map keys to databases, consistently.

## The contract, method by method

- **`resolve(key)`** — pure and deterministic: same key in, same connection string out, no side effects, no I/O. The kernel calls it freely and repeatedly.
- **`exists(key)`** — the fast path runs through this on every checkout, so keep it one cheap query (or one `stat`).
- **`list()`** — every created, not-yet-destroyed key. Only report databases that belong to you: if you prefix database names, filter by that prefix so unrelated databases on the same server stay invisible.
- **`create(key)`** — an empty database the migrator can build up from nothing.
- **`clone(from, to)`** — a _fully independent_ copy: writes to `to` must never affect `from`. This is the invariant the test kit probes hardest. If your backend can't clone, throw — and declare `instantClone: false` so the kernel never calls you.
- **`destroy(key)`** — drop it. The kernel guarantees it only ever destroys manifest-tracked, unprotected keys, so you don't need your own safety net.

## Declaring capabilities

| Flag                | Say `true` when…                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `instantClone`      | You can copy a database fast enough to do it on checkout (file copy, `CREATE DATABASE … TEMPLATE`, CoW snapshot, …). |
| `snapshot`          | It's fine for the kernel to keep extra cloned databases around as fingerprint-keyed golden images for the cache.     |
| `isolatedPerBranch` | Each key maps to a genuinely separate database. (`false` is allowed but disables real isolation; the kernel warns.)  |

Honesty beats ambition: a datasource with `instantClone: false` still works perfectly — the kernel just always takes create → apply → seed. Snapshots are managed entirely by the kernel (they're ordinary databases under a reserved `__snapshot` slug, created with your own `clone`), so `snapshot: true` costs you no extra code — it's a permission, not a feature.

## A complete example

The real SQLite adapter, lightly trimmed — file-per-branch, clone-by-copy:

```ts
import { access, copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { BranchKey, DatasourceAdapter } from 'branchly';

const FILE_SUFFIX = '.sqlite';

export interface SqliteDatasourceOptions {
  readonly dir?: string;
}

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

export const createSqliteDatasource = (options: SqliteDatasourceOptions = {}): DatasourceAdapter => {
  const baseDir = options.dir ?? '.branchly/sqlite';
  const fileFor = (key: BranchKey): string => join(baseDir, `${key}${FILE_SUFFIX}`);
  return {
    id: 'sqlite',
    apiVersion: 1,
    capabilities: { instantClone: true, snapshot: true, isolatedPerBranch: true },
    resolve: (key) => `file:${fileFor(key)}`,
    exists: (key) => fileExists(fileFor(key)),
    list: async () => {
      const entries = await readdir(baseDir).catch(() => []);
      return entries.filter((name) => name.endsWith(FILE_SUFFIX)).map((name) => name.slice(0, -FILE_SUFFIX.length));
    },
    create: async (key) => {
      await mkdir(baseDir, { recursive: true });
      await writeFile(fileFor(key), '', { flag: 'w' });
    },
    clone: async (from, to) => {
      await mkdir(baseDir, { recursive: true });
      await copyFile(fileFor(from), fileFor(to));
    },
    destroy: (key) => rm(fileFor(key), { force: true }),
  };
};

export default createSqliteDatasource;
```

## Prove it

Wire up the [conformance kit](/branchly/authoring/test-kit/#testing-a-datasource) — it verifies create/exists/destroy round-trips, `resolve` determinism, `list` accuracy, clone isolation (via a data probe you provide), and that non-cloning datasources reject `clone`.

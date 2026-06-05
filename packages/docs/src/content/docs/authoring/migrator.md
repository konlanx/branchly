---
title: Writing a migrator
description: Implementing MigratorAdapter — fingerprint, apply, and seed for a new ORM or migration tool.
---

A migrator teaches branchly to speak your ORM: _what migration state is this checkout in, how do I bring a database up to it, and how do I seed?_

## The interface

```ts
interface MigratorAdapter {
  readonly id: string;
  readonly apiVersion: number;

  fingerprint(): Promise<string>;

  apply(connection: ConnectionString): Promise<void>;

  seed(connection: ConnectionString): Promise<void>;

  drift?(connection: ConnectionString): Promise<boolean>;
  status?(connection: ConnectionString): Promise<string>;
}
```

## The contract, method by method

### `fingerprint()` — deterministic identity of the migration set

A hash of the migration set at the current checkout. The rules:

- **Deterministic** — same migration set, same fingerprint, every time, on every machine. Sort before hashing; never include timestamps, paths, or randomness.
- **Sensitive to the set** — adding or removing a migration must change it.

The fingerprint is the key to everything fast in branchly: it decides whether two branches can share a snapshot and whether a database is already current. The first-party migrators hash the **sorted migration file/directory names** — simple, stable, and exactly as granular as the migration set itself.

```ts
import { createHash } from 'node:crypto';

export const fingerprintNames = (names: readonly string[]): string =>
  createHash('sha256')
    .update([...names].sort().join('\n'))
    .digest('hex')
    .slice(0, 16);
```

### `apply(connection)` — idempotent, always

**This is the load-bearing constraint of the whole system.** `apply` must run only _pending_ migrations — a no-op on an up-to-date database, the delta on a cloned ancestor, the full set on an empty database. That single property lets the kernel treat "built from empty", "cloned from an exact match", and "cloned from a parent branch" through one uniform path.

Most migration tools have a deploy-style command that already behaves this way (`prisma migrate deploy`, `drizzle-kit migrate`, `knex migrate:latest`). Shell out to it with the connection injected into the environment:

```ts
apply: (connection) => run(applyCommand, { ...process.env, DATABASE_URL: connection }, cwd),
```

What it must **never** do: reset, drop, prompt, or generate new migrations.

### `seed(connection)` — populate a fresh database

Run the project's seed step against the given connection. The kernel only calls `seed` on databases built from empty — clones already carry their seed data — so you don't need to guard against double-seeding (though a tolerant seed never hurts). The first-party migrators take the seed command as an option (`seed: 'tsx prisma/seed.ts'`) and simply skip seeding when it's unset.

### `drift?` and `status?` — optional niceties

`drift` reports whether the database schema has diverged from the migration history; `status` returns a human-readable summary used by `branchly status`. Skip them until you want them — optional really means optional.

## Connection plumbing

Migration CLIs usually read their connection from an env var. Take the variable name as an option (the first-party adapters call it `urlEnv`, defaulting to `DATABASE_URL`), and set it — overriding any inherited value — in the child environment for both `apply` and `seed`.

## Prove it

Wire up the [conformance kit](/branchly/authoring/test-kit/#testing-a-migrator) — it verifies fingerprint determinism and sensitivity, `apply` idempotency (it applies twice and expects no error), and that `seed` succeeds on a freshly applied database.

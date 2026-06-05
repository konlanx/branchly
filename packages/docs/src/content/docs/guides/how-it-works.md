---
title: How it works
description: Branch keys, migration fingerprints, and the provisioning algorithm at branchly's core.
---

branchly is a small kernel surrounded by plugins. The kernel decides _what_ should happen when you land on a branch; adapters decide _how_ it happens for your particular stack. Understanding three ideas — slugs, fingerprints, and keys — explains nearly everything branchly does.

## The four axes

Variation in this problem space isn't one-dimensional. Four concerns vary independently, and branchly models each as its own plugin axis:

| Axis           | Question it answers                                             | Examples                  |
| -------------- | --------------------------------------------------------------- | ------------------------- |
| **Migrator**   | How do I bring a database to this branch's schema, and seed it? | Prisma, Drizzle, Knex     |
| **Datasource** | How do I create, clone, address, and destroy a database?        | PostgreSQL, MySQL, SQLite |
| **Resolver**   | Where does the app find the resolved connection string?         | `.env` file, direnv       |
| **VCS**        | What is "the current branch", and what signals a change?        | Git                       |

Because the axes are orthogonal, any migrator works with any datasource. Modeling them as one combined adapter would require an `M × N` explosion of plugins; two independent axes meeting in a shared kernel means `M + N` plugins, and every combination works for free.

```
            ┌─────────────────────────────────────────┐
            │                 KERNEL                   │
            │  branch→key · provisioning · cache · gc  │
            └───────┬───────────┬───────────┬─────────┘
                    │           │           │
        ┌───────────▼──┐  ┌─────▼──────┐  ┌─▼──────────┐  ┌──────────┐
        │  Migrator    │  │ Datasource │  │  Resolver  │  │   VCS    │
        │  (Prisma…)   │  │ (Postgres…)│  │ (env-file…)│  │  (git)   │
        └──────────────┘  └────────────┘  └────────────┘  └──────────┘
```

## Slugs, fingerprints, and keys

**Slug** — the branch name made identifier-safe: lowercased, non-alphanumerics collapsed to `_`, capped at 48 characters, with a short hash suffix if two branches would collide. `feature/login` becomes `feature_login`.

**Fingerprint** — a deterministic 16-character hash of the migration set at the current checkout. Same migrations, same fingerprint; add a migration and the fingerprint changes. This is what lets branchly know two branches share schema state without inspecting any database.

**BranchKey** — the two joined together: `<slug>__<fingerprint>`, e.g. `feature_login__a1b2c3d4e5f6a7b8`. Every database branchly creates is named from a key (with a configurable prefix, so `app_feature_login__a1b2c3d4e5f6a7b8` in PostgreSQL).

Keying on slug **and** fingerprint means the same branch gets a _new_ database when its migrations change — the old state is never silently mutated, and the snapshot cache can be keyed by fingerprint alone.

## The provisioning algorithm

Every checkout (and every `branchly sync`) runs the same adapter-agnostic flow:

1. **Compute the key** — `slugify(vcs.currentRef())` + `migrator.fingerprint()`.
2. **Fast path** — if `datasource.exists(key)`, inject the connection and stop. This is the overwhelmingly common case and costs almost nothing.
3. **Try to clone** — if the datasource supports instant cloning, pick the best clone source (see below). A clone arrives already migrated and seeded.
4. **Or create empty** — the universal fallback every datasource supports.
5. **Apply migrations** — `migrator.apply(conn)` is _idempotent_: on an exact clone it's a no-op, on an ancestor clone it runs exactly the delta, on a fresh database it builds the full schema. This one property collapses every path into a single code path.
6. **Seed if fresh** — clones already carry seed data, so `seed` only runs on databases created empty.
7. **Snapshot** — if the datasource supports snapshots, cache this fully-built state as a golden image for future branches with the same fingerprint.
8. **Record and inject** — the manifest remembers the key; the resolver points your app at the new connection.

## Capability negotiation

Datasources declare what they can do, and the kernel picks the best strategy they support:

| `instantClone` | `snapshot` | Strategy on a new branch                                                                   |
| :------------: | :--------: | ------------------------------------------------------------------------------------------ |
|       ✅       |     ✅     | Clone from a fingerprint-matched snapshot; on a miss, build fresh and snapshot the result. |
|       ✅       |     ❌     | Clone from a sibling branch sharing migration ancestry; on a miss, build fresh.            |
|       ❌       |     ❌     | Always create → apply → seed. Correct on any backend, just slower.                         |

Graceful degradation is the point: a datasource with no special powers still works, it just takes the scenic route.

## Where state lives

branchly keeps its manifest (the record of every database it created) and snapshot bookkeeping inside your repository's **shared `.git` directory** — so if you use `git worktree`, every worktree sees the same state, shares the same snapshot cache, and prune/gc operate on one source of truth. Nothing branchly tracks ever needs committing.

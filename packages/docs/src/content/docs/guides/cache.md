---
title: Snapshots & cloning
description: How branchly makes first visits to a branch nearly as fast as return visits.
---

Return visits to a branch are instant — the database already exists. The snapshot cache is how branchly makes _first_ visits fast too.

## Golden images, keyed by fingerprint

A **snapshot** is a fully-migrated-and-seeded database state, cached and keyed by the [migration fingerprint](/branchly/guides/how-it-works/#slugs-fingerprints-and-keys) that produced it. Because most branches share the bulk of their migration history, a brand-new branch usually has the _same_ fingerprint as something branchly has already built — so instead of paying a full create → migrate → seed, it clones the golden image in well under a second.

The cache fills itself: whenever branchly finishes a full build on a snapshot-capable datasource, it snapshots the result for next time. No warming step, no maintenance.

## How a clone source is picked

When a branch needs a database, branchly looks for the best starting point, in order:

1. **A snapshot with the exact fingerprint** — clone it; `apply` is a no-op and `seed` is skipped. Instant, and the seed data comes along.
2. **A live branch database with the exact fingerprint** — same deal, cloned from a sibling.
3. **The configured base branch's database** (`cache.base`, default `main`) — clone it, then `apply` runs just the delta migrations on top. Your feature branch inherits main's seed data and gains only its new columns.
4. **Nothing suitable** — create empty, apply everything, seed, and (where supported) snapshot the result so the next branch is instant.

This all rests on one rule: **`apply` is idempotent** — it only ever runs pending migrations. That's what makes "cloned from an exact match", "cloned from an ancestor", and "built from scratch" safely identical from the kernel's point of view.

## What cloning costs

Cloning is delegated to the datasource, using whatever trick it has:

| Datasource | Clone mechanism                                                                  |
| ---------- | -------------------------------------------------------------------------------- |
| PostgreSQL | `CREATE DATABASE … TEMPLATE` — a file-level copy, typically sub-second.          |
| SQLite     | A file copy. Hard to beat.                                                       |
| MySQL      | SQL-level replay (schema + `INSERT … SELECT`) — fast for development-sized data. |

Datasources that can't clone at all still work — they just always take the create → apply → seed path. See [capability negotiation](/branchly/guides/how-it-works/#capability-negotiation).

## Keeping the cache trim

The cache is bounded by `cache.max` (default 10). `branchly gc` — and you'll be nudged when it's worth running — evicts the least-recently-cloned snapshots beyond the limit and drops their backing databases. The `cache.base` snapshot is never evicted, since it's the fallback everything else clones from.

```ts
cache: { enabled: true, max: 10, base: 'main' }
```

Set `enabled: false` to skip snapshot creation entirely; branchly then clones from live sibling databases where possible and rebuilds otherwise.

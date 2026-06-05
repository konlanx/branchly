---
title: Cleanup & pruning
description: How branchly keeps your machine from accumulating orphaned databases — and the safety rules it never breaks.
---

Per-branch databases are wonderful right up until you have forty of them. branchly cleans up after itself in three ways: automatic upkeep, merge-time offers, and explicit commands.

## The safety rules (non-negotiable)

Before anything else, the rules every destructive path obeys:

- branchly **only ever drops databases recorded in its own manifest** — things it created. Your other databases are invisible to it.
- It **never touches a `protect`-listed branch** (`main`, `master`, `production` by default).
- The only database it drops _without asking_ is one whose branch no longer exists locally — and even that is opt-out.
- Everything else confirms first, or is dry-run by default.

## Automatic upkeep

After provisioning (never blocking your checkout), the `post-checkout` hook runs a sweep — throttled to at most once a day:

- **Dead branches are dropped.** A branch you deleted locally no longer needs its database. Gated by `prune.autoDropDeleted` (default on).
- **Stale branches earn a nudge.** Branches that still exist but haven't been visited in `prune.maxAgeDays` (default 30) pile up quietly; branchly prints a friendly pointer at `branchly prune --stale` when they do. It never drops a live branch's database on its own. Gated by `prune.nudge` (default on).

Staleness is measured from each entry's `lastUsedAt`, refreshed on every visit — fast path included.

## `branchly prune`

The explicit version of the same idea:

```sh
branchly prune            # dry-run: shows what would be dropped
branchly prune --force    # actually drop databases of deleted branches
branchly prune --stale    # also reclaim long-untouched live branches
```

Reclaiming a stale-but-alive branch is safe: the moment you check it out again, branchly re-provisions it — usually instantly, from a snapshot.

## `post-merge` offers

Merged a feature branch? Its database has probably served its purpose. The `post-merge` hook (installed by `init`) finds manifest-tracked branches now merged into the current one and **offers** to drop their databases. Declining is the default; protected and untracked branches are never even offered.

## `branchly gc`

Cleans the other kind of accumulation: cached snapshots. Evicts the least-recently-cloned beyond `cache.max` and drops their backing databases, never touching the base snapshot. See [snapshots & cloning](/branchly/guides/cache/).

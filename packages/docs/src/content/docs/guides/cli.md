---
title: CLI commands
description: The full branchly command reference.
---

After `init`, branchly runs itself on every checkout — you'll rarely reach for these by hand. But when you do:

| Command                              | What it does                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `branchly init [--no-install]`       | Detect your stack, install adapters, write the config, and install Git hooks. |
| `branchly sync`                      | Provision the current branch's database now (same flow as the hook).          |
| `branchly status`                    | Show the current branch → database mapping and migration/seed state.          |
| `branchly run -- <cmd> [args…]`      | Provision, then run `<cmd>` with the branch connection injected into its env. |
| `branchly prune [--force] [--stale]` | Drop databases for deleted branches; `--stale` reclaims long-untouched ones.  |
| `branchly gc`                        | Evict cached snapshots beyond `cache.max` and drop their databases.           |
| `branchly doctor`                    | Diagnose config, plugin, VCS, and database-connection problems.               |

Every command accepts `--quiet` to suppress the playful chatter; errors always show.

## `branchly init`

The one-time setup. Detects migrator + datasource + resolver, installs the matching adapter packages with your detected package manager, writes `branchly.config.ts` (keeping an existing one untouched), gitignores your env file, and installs the `post-checkout` and `post-merge` hooks — chaining onto existing hooks or Husky rather than overwriting. With `--no-install` it prints the install command instead of running it.

## `branchly sync`

Runs the [provisioning algorithm](/branchly/guides/how-it-works/#the-provisioning-algorithm) for the current branch. Useful in CI, after a `git pull` that brought new migrations, or any time you want to be sure you're in sync. Already provisioned? It's a fast, quiet no-op.

## `branchly status`

Tells you where you are: current branch, the key it maps to, whether the database exists, and what the migrator reports about it.

## `branchly run -- <cmd>`

For setups where the environment is injected rather than read from a file (Doppler, CI): provisions the current branch, then launches `<cmd>` with the per-branch connection set in its environment — set last, so it wins over injected values. See [injected environments](/branchly/guides/injected-envs/).

## `branchly prune`

Lists databases belonging to branches that no longer exist locally — **dry-run by default**, `--force` to actually drop them. `--stale` additionally reclaims databases for branches that still exist but haven't been visited in `prune.maxAgeDays` (a return visit just re-provisions, usually from a snapshot). branchly only ever considers databases recorded in its own manifest, and never touches `protect`-listed branches.

## `branchly gc`

Bounds the snapshot cache: evicts the least-recently-cloned snapshots beyond `cache.max` and drops their backing databases. The configured `cache.base` snapshot is never evicted.

## `branchly doctor`

Checks each layer in order — config load, plugin resolution and load, `vcs.currentRef`, datasource connectivity — reports every result, and exits non-zero if anything fails. Start here when something feels off.

## Hook entry points

`branchly on-checkout <prev> <next> <flag>` and `branchly post-merge` are the commands the Git hooks invoke — you won't call them yourself. `on-checkout` early-exits on file checkouts and same-branch no-ops before doing any work, then provisions and (at most once a day) runs the [upkeep sweep](/branchly/guides/cleanup/). `post-merge` offers to drop databases of branches you've just merged.

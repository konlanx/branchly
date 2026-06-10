---
title: Configuration
description: Everything you can set in branchly.config.ts, and what the defaults do.
---

branchly reads a single config: `branchly.config.ts` at the project root (a `branchly` key in `package.json` works too). `branchly init` generates it from what it detects, and committing it shares the setup with your team.

A typical generated config:

```ts
import { defineConfig, env } from 'branchly';

export default defineConfig({
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres', url: env('DATABASE_URL'), prefix: 'app' },
  resolver: { use: 'env-file', file: '.env', key: 'DATABASE_URL' },
  protect: ['main', 'master', 'production'],
  cache: { enabled: true, max: 10, base: 'main' },
  prune: { autoDropDeleted: true, maxAgeDays: 30, nudge: true },
});
```

`defineConfig` is an identity function that exists purely to give you types and autocompletion.

## Adapter selection: `use`

Every axis (`migrator`, `datasource`, `resolver`, plus the top-level `vcs` string) names its adapter with a short alias or a full package name:

- `use: 'prisma'` resolves to `@branchly/migrator-prisma` (likewise `datasource-*`, `resolver-*`, `vcs-*`).
- `use: '@yourorg/branchly-migrator-flyway'` — anything containing `@` or `/` is treated as a fully-qualified package name, which is how third-party adapters plug in.

Any other keys in an adapter's block are passed through to that adapter as options. Each adapter documents its own — see the [adapters section](/branchly/adapters/overview/).

## `env()` references

`env('DATABASE_URL')` defers a value to the environment at load time, so your config can be committed without committing a connection string. branchly also auto-loads `.env` (non-overriding, so Doppler, direnv, and CI-injected values win).

For the datasource `url`, branchly derives its maintenance connection from your app's existing connection string by swapping the database name — there is no separate admin variable to set.

## `protect`

Branches branchly must never touch destructively. `prune`, `gc`, sweeps, and `post-merge` offers all refuse to drop a protected branch's database, always. Defaults to `['main', 'master', 'production']`.

## `cache`

| Key       | Default  | Meaning                                                                            |
| --------- | -------- | ---------------------------------------------------------------------------------- |
| `enabled` | `true`   | Cache fingerprint-keyed snapshots and prefer them as clone sources.                |
| `max`     | `10`     | Keep at most this many snapshots; `gc` evicts the least-recently-cloned beyond it. |
| `base`    | `'main'` | The branch whose state is the fallback clone source — and is never evicted.        |

More in [snapshots & cloning](/branchly/guides/cache/).

## `prune`

Controls the automatic upkeep that runs (at most once a day) after a checkout:

| Key               | Default | Meaning                                                                            |
| ----------------- | ------- | ---------------------------------------------------------------------------------- |
| `autoDropDeleted` | `true`  | Auto-drop databases whose branch no longer exists locally.                         |
| `maxAgeDays`      | `30`    | Age at which a still-alive branch counts as stale for `branchly prune --stale`.    |
| `nudge`           | `true`  | Print a gentle reminder when stale branches pile up (never drops anything itself). |

More in [cleanup](/branchly/guides/cleanup/).

## `quiet`

Suppresses the friendly chatter, keeping only what you strictly need — errors always show. The `--quiet` CLI flag does the same per invocation.

---
title: Doppler, direnv & injected environments
description: Using branchly when your environment comes from a secret manager instead of a .env file.
---

The default resolver writes the per-branch connection into your `.env` file, which covers most projects. But plenty of teams inject environment instead — Doppler, direnv, CI secrets. branchly is friendly to all of them, on both the input and the output side.

## The input side: where branchly finds your connection

branchly derives everything from your existing `DATABASE_URL` — it keeps the host and credentials and swaps the database name. It looks for that value the way your app does:

- **`.env` files** are auto-loaded, _non-overriding_ — values already present in the process environment always win. So Doppler-, direnv-, or CI-injected values take precedence naturally.
- **Doppler** — when a `doppler.yaml` is detected, `init` wraps the Git hooks in `doppler run`, so the hook sees the same secrets your app does.
- **direnv / CI** — exported variables are simply there; nothing to configure.

## The output side: where your app finds the branch database

### Option 1: file-based resolvers

The `env-file` resolver upserts the key into `.env`; the [`direnv` resolver](/branchly/adapters/direnv/) does the same with `export` lines in `.envrc`:

```ts
resolver: { use: 'direnv', file: '.envrc', key: 'DATABASE_URL' }
```

### Option 2: `branchly run` for injected setups

When your environment is injected at launch time, a file write isn't enough — the injector would overwrite it. `branchly run` solves the ordering: it provisions the current branch, then launches your command with the per-branch connection set **last**, so it wins:

```sh
doppler run -- branchly run -- npm run dev
```

Doppler injects your secrets, then branchly overrides just the database URL with the current branch's. Works the same with any injector:

```sh
branchly run -- npm run dev          # plain
direnv exec . branchly run -- npm test
```

`branchly run` passes the child's exit code through, so it composes fine with scripts and CI steps.

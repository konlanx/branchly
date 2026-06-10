---
title: Doppler, direnv & injected environments
description: Using branchly when your environment comes from a secret manager instead of a .env file.
---

The default resolver writes the per-branch connection into your `.env` file, which covers most projects. But plenty of teams inject environment instead — Doppler, direnv, CI secrets. branchly is friendly to all of them, on both the input and the output side.

## The input side: where branchly finds your connection

branchly derives everything from your existing `DATABASE_URL` — it keeps the host and credentials and swaps the database name. The catch is that your **git hooks** run in their own environment, which may differ from your shell. So during `init`, branchly detects _how_ that value reaches your project and wires the hooks to match:

- **`.env` files** are auto-loaded, _non-overriding_ — values already present in the process environment always win. So Doppler-, direnv-, or CI-injected values take precedence naturally.
- **Doppler** — detected from a `doppler.yaml` **or** a logged-in `doppler` CLI with a configured project. When chosen, `init` wraps the Git hooks in `doppler run`, so the hook sees the same secrets your app does.
- **direnv** — detected from an `.envrc` plus the `direnv` binary; `init` wraps the hooks in `direnv exec`.
- **shell** — a value already exported in your environment. Convenient, but a fresh shell, CI runner, or git hook may not have it, so branchly says so rather than assuming.

In an interactive terminal, `init` confirms the detected source with you (and lets you pick another); in CI or with `--yes` it takes the top match, falling back to `.env`. Either way it then **verifies** that `DATABASE_URL` actually resolves the way the hooks will see it — if it can't, `init` tells you exactly what's missing instead of writing a config that silently won't work. You can pin the choice with `branchly init --env=doppler` (or `direnv`, `env-file`, `shell`), and re-check anytime with `branchly doctor`.

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

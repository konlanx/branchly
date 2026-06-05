---
title: direnv
description: The @branchly/resolver-direnv adapter — pointing your shell at the branch database via .envrc.
---

`@branchly/resolver-direnv` writes the branch connection as an `export` line in your [direnv](https://direnv.net/) `.envrc`, so every shell in the project directory sees the current branch's database.

## Configuration

```ts
resolver: {
  use: 'direnv',
  file: '.envrc',
  key: 'DATABASE_URL',
}
```

| Option | Default          | Meaning                        |
| ------ | ---------------- | ------------------------------ |
| `file` | `'.envrc'`       | The direnv file to write into. |
| `key`  | `'DATABASE_URL'` | The variable to export.        |

## Behavior

Like the [env-file resolver](/branchly/adapters/env-file/), the write is an upsert: an existing `export DATABASE_URL=…` line is replaced, everything else in your `.envrc` is preserved, and the line is appended if missing.

One direnv-ism to know: direnv re-evaluates `.envrc` when it changes, but an already-running process keeps the environment it started with. For long-running processes that should follow branch switches, [`branchly run`](/branchly/guides/injected-envs/) is the more direct tool.

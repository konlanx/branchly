---
title: env file
description: The @branchly/resolver-env-file adapter — pointing your app at the branch database via .env.
---

`@branchly/resolver-env-file` is the default resolver: after provisioning, it upserts the branch's connection string into your `.env` file, so anything that reads `.env` — your app, Prisma, scripts — picks up the right database automatically.

## Configuration

```ts
resolver: {
  use: 'env-file',
  file: '.env',
  key: 'DATABASE_URL',
}
```

| Option | Default          | Meaning                     |
| ------ | ---------------- | --------------------------- |
| `file` | `'.env'`         | The env file to write into. |
| `key`  | `'DATABASE_URL'` | The variable to set.        |

## Behavior

The write is an **upsert**: an existing `DATABASE_URL=` line is replaced in place, every other line is left exactly as it was, and the key is appended if absent. Your comments and other variables survive every branch switch.

`branchly init` makes sure the file is gitignored — the value changes per branch and per machine, so it should never be committed.

Using direnv or CI-injected environments where a file write would be overridden at launch? Pair this with [`branchly run`](/branchly/guides/injected-envs/), or use the [direnv resolver](/branchly/adapters/direnv/).

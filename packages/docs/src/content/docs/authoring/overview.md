---
title: Writing an adapter
description: The anatomy of a branchly adapter — factories, apiVersion, options, and how the kernel finds you.
---

branchly grows by adapters, and adapters are deliberately small: the SQLite datasource is under a hundred lines, the direnv resolver under fifty. This section walks through everything you need to write one — and the [conformance test kit](/branchly/authoring/test-kit/) tells you when it's correct.

## Pick your axis

An adapter implements exactly one of branchly's [four axes](/branchly/guides/how-it-works/#the-four-axes):

| You want to support…                      | Write a…                                            | Interface            |
| ----------------------------------------- | --------------------------------------------------- | -------------------- |
| A database / provisioning backend         | [datasource](/branchly/authoring/datasource/)       | `DatasourceAdapter`  |
| An ORM / migration tool                   | [migrator](/branchly/authoring/migrator/)           | `MigratorAdapter`    |
| A way to expose the connection to the app | [resolver](/branchly/authoring/resolver/)           | `ConnectionResolver` |
| A version control system                  | (open an issue first — git is the only one so far!) | `Vcs`                |

All four interfaces are exported as types from the `branchly` package.

## The anatomy

Every adapter package follows the same shape: it **default-exports a factory function** that receives the adapter's config block and returns the adapter object.

```ts
import { writeFile } from 'node:fs/promises';

import type { ConnectionResolver } from 'branchly';

export interface MyResolverOptions {
  readonly file?: string;
}

export const createMyResolver = (options: MyResolverOptions = {}): ConnectionResolver => ({
  id: 'my-resolver',
  apiVersion: 1,
  inject: (connection) => writeFile(options.file ?? '.connection', `${connection}\n`, 'utf8'),
});

export default createMyResolver;
```

Three things the loader checks at startup, with friendly errors if they're missing:

1. **A default-exported factory.** The kernel dynamically imports your package and calls `default(options)`.
2. **Options flow from the config.** Everything in the user's adapter block — minus nothing, the whole object — is passed to your factory. `{ use: 'my-resolver', file: '.envrc' }` arrives as `options`, so document your options and give them sensible defaults.
3. **`apiVersion`.** Your returned adapter declares which interface version it targets (currently `1`). If branchly and the adapter disagree, the user gets an actionable message — "upgrade the adapter or branchly so the two agree" — instead of a stack trace. Bump it only when branchly announces a breaking interface change.

## Naming and resolution

Users select adapters with `use`. Short names resolve by convention to first-party packages: `use: 'postgres'` → `@branchly/datasource-postgres`. Anything containing `@` or `/` is used verbatim — so publish your adapter under any name and it's selectable as:

```ts
export default defineConfig({
  datasource: { use: '@yourorg/branchly-datasource-cockroach' },
});
```

We suggest naming third-party packages `branchly-<axis>-<name>` or `@scope/branchly-<axis>-<name>` so they're easy to find.

## The development loop

1. Scaffold a package with the interface type from `branchly` and a default-exported factory.
2. Add `@branchly/adapter-test-kit` as a dev dependency and wire up the [conformance suite](/branchly/authoring/test-kit/) — it encodes the real contract, invariant by invariant.
3. Iterate until the kit is green.
4. [Publish](/branchly/authoring/publishing/) — or PR it into the branchly monorepo; contributions are very welcome.

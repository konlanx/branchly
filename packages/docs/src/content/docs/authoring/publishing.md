---
title: Publishing your adapter
description: Shipping a branchly adapter — package shape, naming, and how users select it.
---

Your adapter passes the [conformance kit](/branchly/authoring/test-kit/)? Wonderful. Two ways to ship it:

## Option A: contribute it to the monorepo

First-party adapters live in the [branchly monorepo](https://github.com/konlanx/branchly) under `packages/<axis>-<name>` and release together with core. If your adapter targets a reasonably common tool, a PR is very welcome — you get the short alias (`use: 'cockroach'`), CI with service containers, and shared maintenance. Bring the adapter, its conformance test file, and any options documented in the package README.

## Option B: publish independently

Any npm package works as an adapter — users select it by its full name:

```ts
export default defineConfig({
  datasource: { use: '@yourorg/branchly-datasource-cockroach' },
});
```

### Package checklist

- **Name it discoverably** — `branchly-<axis>-<name>` or `@scope/branchly-<axis>-<name>`.
- **Default-export the factory.** The loader imports your package and calls `default(options)` with the user's adapter config block.
- **Declare `apiVersion: 1`** on the returned adapter. branchly verifies it at load time and gives users an actionable message on mismatch.
- **Type against `branchly`.** Add it as a peer (or dev) dependency and implement the exported `DatasourceAdapter` / `MigratorAdapter` / `ConnectionResolver` / `Vcs` types.
- **Ship ESM.** The loader uses dynamic `import()`, resolved from the user's project root — `"type": "module"` with standard `exports` is the happy path.
- **Run the kit in your CI.** "Passes `@branchly/adapter-test-kit`" is the compatibility claim your README should be able to make.

### A minimal `package.json`

```json
{
  "name": "@yourorg/branchly-datasource-cockroach",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "peerDependencies": {
    "branchly": ">=0.1.0"
  },
  "devDependencies": {
    "@branchly/adapter-test-kit": "^0.1.0",
    "vitest": "^4.0.0"
  }
}
```

### Versioning against branchly

`apiVersion` tracks the adapter _interface_, not branchly's package version. It only bumps on breaking interface changes — which branchly treats as a big deal and announces loudly. Until then, an `apiVersion: 1` adapter keeps working across branchly releases.

That's it. Tell us about your adapter in a [GitHub issue](https://github.com/konlanx/branchly/issues) — we'd love to link it from these docs. 💚

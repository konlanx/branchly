# branchly

> Give every Git branch its own database. Switch branches, and your data follows.

[![npm](https://img.shields.io/npm/v/branchly.svg)](https://www.npmjs.com/package/branchly)
[![CI](https://github.com/konlanx/branchly/actions/workflows/ci.yml/badge.svg)](https://github.com/konlanx/branchly/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

When your branches carry different migrations, a single shared development database is constantly out of step with whatever you have checked out, so your migration tool resets it and your data is gone. **branchly** gives each branch its own isolated database and keeps them in sync for you: the first time you visit a branch it provisions one (create → migrate → seed), every later visit is instant, and it all happens on `git checkout`, so most of the time you do nothing at all.

It's local-first and plugin-based, so it isn't tied to a single stack. Out of the box it speaks **Git**, **Prisma**, **PostgreSQL**, and your **`.env`** file, with MySQL, SQLite, Drizzle, Knex, and direnv adapters alongside, and room for more.

📚 **Full documentation:** [konlanx.github.io/branchly](https://konlanx.github.io/branchly/) — guides, adapter references, and the adapter-authoring guide.

## Installation

Install one package — use whatever package manager your project already uses:

```sh
npm install --save-dev branchly   # npm
pnpm add -D branchly              # pnpm
yarn add -D branchly              # Yarn
```

Then let branchly set itself up:

```sh
npx branchly init     # or: pnpm branchly init · yarn branchly init
```

That single command discovers your stack, **installs the adapter packages it needs**, writes a `branchly.config.ts`, and wires up the Git hook. The necessary adapters and your package manager are detected automatically.

Branchly automatically detects a `.env` file, Doppler, direnv, CI secrets, or your Prisma datasource. It keeps the host and credentials and just swaps the database name: a maintenance connection for creating and cloning databases, and a fresh `app_<branch>` database for each branch. Nothing new to set.

That's it. From now on, switching branches just works:

```sh
git checkout -b feature/login   # branchly provisions a fresh database
git checkout main               # …and instantly switches back to main's
```

You can commit the generated `branchly.config.ts` so your whole team shares the same setup.

## Commands

| Command                 | What it does                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| `branchly init`         | Detect your stack, install adapters, write the config, and install the hook. |
| `branchly sync`         | Provision the current branch's database now.                                 |
| `branchly status`       | Show the current branch → database mapping.                                  |
| `branchly run -- <cmd>` | Run `<cmd>` with the per-branch database connection injected into its env.   |
| `branchly prune`        | Drop databases for branches that no longer exist (`--force` to apply).       |
| `branchly gc`           | Evict cached database snapshots beyond the cache limit.                      |
| `branchly doctor`       | Diagnose configuration, plugin, and database-connection problems.            |

After `init`, branchly runs automatically on every `git checkout`, so you'll rarely reach for these by hand. Add `--quiet` to any command to silence its output (errors always show).

## Supported tools

| Category         | Tool       | Status       |
| ---------------- | ---------- | ------------ |
| Package manager  | npm        | ✅ Supported |
| Package manager  | pnpm       | ✅ Supported |
| Package manager  | Yarn       | ✅ Supported |
| Package manager  | Bun        | ✅ Supported |
| Database         | PostgreSQL | ✅ Supported |
| Database         | SQLite     | ✅ Supported |
| Database         | MySQL      | ✅ Supported |
| Database         | Neon       | 🔜 Planned   |
| ORM / migrations | Prisma     | ✅ Supported |
| ORM / migrations | Drizzle    | ✅ Supported |
| ORM / migrations | Knex       | ✅ Supported |

If you would like to expand this list, we would love your contribution!

## Building from source

branchly is a pnpm + TypeScript monorepo.

```sh
git clone https://github.com/konlanx/branchly.git
cd branchly
pnpm install
pnpm build      # build every package
pnpm test       # run the test suite
pnpm lint       # lint and type-check
```

### Trying a local build in another project

Since the packages aren't published, install them from tarballs. First, pack them from the
branchly repo:

```sh
mkdir -p /tmp/branchly-packs
for pkg in core vcs-git migrator-prisma datasource-postgres resolver-env-file; do
  (cd "packages/$pkg" && pnpm pack --pack-destination /tmp/branchly-packs)
done
```

(Add `migrator-drizzle`, `migrator-knex`, `datasource-mysql`, `datasource-sqlite`, or `resolver-direnv` to that list
if your stack needs them.)

Then, in **your project**, install the tarballs as dev dependencies. With npm or pnpm a glob works:

```sh
npm install --save-dev /tmp/branchly-packs/*.tgz
```

Yarn doesn't expand globs itself, so let your shell do it:

```sh
yarn add -D $(ls /tmp/branchly-packs/*.tgz)
```

Finally, set it up. Use `--no-install`, since `init` can't fetch the unpublished adapters from a
registry (you've already installed them above):

```sh
npx branchly init --no-install      # or: yarn branchly init --no-install
```

> Re-packing after a change? The version stays the same, so package managers may serve a cached
> copy — run `yarn cache clean` (Yarn Berry) or reinstall the tarballs (npm/pnpm) first.

## Contributing

Contributions are welcome! Issues, ideas, and pull requests all help. branchly grows mostly by **adapters**: support for a new ORM, database, or connection style is a small, self-contained plugin, and a conformance test kit makes new adapters easy to get right. If you'd like to add one or fix something, jump in.

## License

MIT

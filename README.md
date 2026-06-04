# branchly

> Give every git branch its own database — switch branches, and your database state follows automatically.

## What it does

When several branches contain different schema migrations, a single shared development
database constantly drifts out of sync with whatever branch you have checked out. Migration
tools notice the mismatch and reset the database, wiping your data and forcing a reseed.

**branchly** gives each branch its own isolated database state and makes moving between
those states automatic and fast:

- The first time you visit a branch, branchly provisions it for you (create → migrate → seed).
- Every later visit is instant — no migrate, no reseed.
- It hooks into `git checkout`, so most of the time you do nothing at all.

It's local-first and works through small plugins, so it isn't tied to one ORM or database.
The reference setup is **git + Prisma + PostgreSQL**.

## Requirements

- **Node.js 22+**
- A **git** repository
- A **PostgreSQL** server you can create databases on (the reference datasource uses
  `CREATE DATABASE … TEMPLATE` for instant clones)
- A **Prisma** project with a `prisma/migrations` folder (the reference migrator runs
  `prisma migrate deploy`)

## Install

Install branchly and the reference plugins as dev dependencies:

```sh
npm install --save-dev branchly \
  @branchly/vcs-git \
  @branchly/migrator-prisma \
  @branchly/datasource-postgres \
  @branchly/resolver-env-file
```

(Use the equivalent `pnpm add -D` or `yarn add -D` if that's your package manager.)

## Quick start

branchly reads its **admin** Postgres connection from `BRANCHLY_DATABASE_URL` — point it at a
database you can create others from (the maintenance `postgres` database is a good choice).
Put it wherever you keep secrets: a `.env` file (branchly loads it automatically), or an
injected environment (Doppler, direnv, CI). No `export` needed.

```sh
# .env
BRANCHLY_DATABASE_URL=postgres://user:pass@localhost:5432/postgres
```

```sh
# 1. Set up branchly: detect your stack, write a config, install the git hook
npx branchly init

# 2. Provision the branch you're on right now
npx branchly sync
```

After `init`, branchly runs automatically whenever you `git checkout` a branch — switching
branches selects (or provisions) the matching database with no manual steps.

```sh
git checkout -b feature/new-thing   # branchly provisions a fresh database for it
git checkout main                    # branchly instantly switches back to main's database
```

Check what's going on at any time:

```sh
npx branchly status
```

## Commands

| Command                | What it does                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `branchly init`        | Detect your stack, write `branchly.config.ts`, install the git `post-checkout` hook, and update `.gitignore`. |
| `branchly sync`        | Provision the current branch now (the same flow the hook runs).                                               |
| `branchly status`      | Show the current branch → database mapping and whether it's provisioned.                                      |
| `branchly on-checkout` | Internal hook entry point — runs automatically on `git checkout`.                                             |

Add `--quiet` to any command to silence the output (errors still show).

## Configuration

`branchly init` writes a `branchly.config.ts` you can commit so your team shares the same setup:

```ts
import { defineConfig, env } from 'branchly';

export default defineConfig({
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres', admin: env('BRANCHLY_DATABASE_URL'), prefix: 'app' },
  resolver: { use: 'env-file', file: '.env', key: 'DATABASE_URL' },
  protect: ['main', 'master', 'production'],
  cache: { enabled: true, max: 10, base: 'main' },
});
```

- `migrator` / `datasource` / `resolver` each name a plugin (`prisma` resolves to
  `@branchly/migrator-prisma`, and so on).
- **Input vs output — two different variables, on purpose.** `datasource.admin` is the
  connection branchly _reads_ (`BRANCHLY_DATABASE_URL`); branchly swaps the database name per
  branch and the `resolver` _writes_ the result to whatever your app reads (`DATABASE_URL` in
  `.env`). Keeping them separate avoids branchly overwriting the value it depends on.
- branchly auto-loads `.env`, but never overrides a variable already present in the
  environment — so injected secrets (Doppler, direnv, CI) always win.

## How it works

Each branch maps to a **key** built from a safe form of the branch name plus a fingerprint of
its migrations. branchly asks the datasource whether a database for that key already exists:

- **It does** → just point your app at it (the instant "fast path").
- **It doesn't** → clone it from a matching database when possible, otherwise create it fresh,
  then run migrations and (for fresh databases) seed.

A small `.branchly/manifest.json` (gitignored) records which databases branchly created so it
can manage them safely.

## Building from source

branchly is a pnpm + TypeScript monorepo. To work on it — or to try unreleased changes in a
real project — build the packages and install the packed tarballs.

```sh
# 1. Build the packages
git clone <this-repo> branchly
cd branchly
pnpm install
pnpm build

# 2. Pack all five packages into tarballs
mkdir -p /tmp/branchly-packs
for pkg in core vcs-git migrator-prisma datasource-postgres resolver-env-file; do
  (cd "packages/$pkg" && pnpm pack --pack-destination /tmp/branchly-packs)
done
```

Then, in **your project**, install the five tarballs.

**npm / pnpm:**

```sh
npm install --save-dev /tmp/branchly-packs/*.tgz
```

**Yarn** (Classic or Berry) — Yarn doesn't expand globs, so list them explicitly:

```sh
yarn add -D \
  /tmp/branchly-packs/branchly-0.0.0.tgz \
  /tmp/branchly-packs/branchly-vcs-git-0.0.0.tgz \
  /tmp/branchly-packs/branchly-migrator-prisma-0.0.0.tgz \
  /tmp/branchly-packs/branchly-datasource-postgres-0.0.0.tgz \
  /tmp/branchly-packs/branchly-resolver-env-file-0.0.0.tgz
```

Run the CLI from the project — with npm/pnpm use `npx branchly …`; with Yarn Berry use
`yarn branchly …`:

```sh
npx branchly init      # or: yarn branchly init
```

> Re-packing from a local build? The version stays the same, so package managers may serve a
> cached copy. With Yarn Berry run `yarn cache clean` first; with npm, reinstall the tarballs.

## Learn more

- [`IMPLEMENTATION_GUIDE.md`](./IMPLEMENTATION_GUIDE.md) — the full architecture specification.
- [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — the build roadmap and current progress.

## Supported tools & databases

branchly works through plugins arranged along four axes:

- **Version control:** Git
- **Migrations & seeding:** Prisma
- **Databases:** PostgreSQL (with `CREATE DATABASE … TEMPLATE` for instant per-branch clones)
- **Connection delivery:** `.env` file

Each axis is a small, self-contained package, so more ORMs and databases — such as Drizzle,
SQLite, or MySQL — can be added as plugins without touching the core.

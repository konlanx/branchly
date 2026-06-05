---
title: Quickstart
description: From zero to per-branch databases in about two minutes.
---

This walkthrough assumes a project with migrations already set up — say, Prisma on PostgreSQL. (Drizzle, Knex, MySQL, and SQLite work the same way; branchly figures out which you have.)

## 1. Install and initialize

```sh
npm install --save-dev branchly
npx branchly init
```

`init` detects your stack, installs the adapters, writes `branchly.config.ts`, and installs the Git hooks. The output tells you exactly what it found and did:

```
branchly init
│
◇ detected:  prisma + postgres + env-file
◇ installing: @branchly/vcs-git, @branchly/migrator-prisma, @branchly/datasource-postgres, @branchly/resolver-env-file (with npm)
◇ config:    wrote branchly.config.ts 📝
◇ gitignore: .env is covered (branchly keeps its state in .git)
◇ checkout:  installed at .husky/post-checkout 🪝
◇ merge:     installed at .husky/post-merge 🪝
◇ next:      nothing! branchly reuses your existing DATABASE_URL (.env, Doppler, etc.) 🌱
│
└ branchly is set up — happy branching! 🎉
```

## 2. Switch a branch

```sh
git checkout -b feature/login
```

The `post-checkout` hook fires, and branchly provisions a database for the new branch — narrating each step on a first build:

```
◇ Spinning up a fresh database 🐣
◇ Applying migrations 🧱
◇ Planting seed data 🌱
◇ Caching a snapshot for next time 📸
└ "feature/login" is ready to go on feature_login__a1b2c3d4e5f6a7b8! 🎉
```

Your `.env` now points `DATABASE_URL` at the new branch's database. Run your app; it just works.

## 3. Switch back

```sh
git checkout main
```

main's database already exists, so this is the fast path — branchly swaps the connection back and stays out of your way:

```
└ "main" is already in sync — nothing to do ✅
```

No migration. No reseed. The data you had on `main` is exactly as you left it.

## 4. That's it

Seriously, that's the workflow. A few things you might want eventually:

- `branchly status` — see which database the current branch maps to.
- `branchly sync` — provision manually, for when you want it now (or in CI).
- `branchly prune` — tidy up databases for branches you've deleted.
- `branchly doctor` — if anything feels off, this diagnoses config, plugins, and connectivity.

Where to next?

- [How it works](/branchly/guides/how-it-works/) — keys, fingerprints, and the provisioning algorithm.
- [Configuration](/branchly/guides/configuration/) — everything in `branchly.config.ts`.
- [CLI commands](/branchly/guides/cli/) — the full command reference.

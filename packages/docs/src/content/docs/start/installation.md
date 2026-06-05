---
title: Installation
description: Install branchly with your package manager of choice — one package, one init command.
---

branchly is one dev dependency. Use whatever package manager your project already uses:

```sh
npm install --save-dev branchly   # npm
pnpm add -D branchly              # pnpm
yarn add -D branchly              # Yarn
bun add -d branchly               # Bun
```

Then let branchly set itself up:

```sh
npx branchly init     # or: pnpm branchly init · yarn branchly init
```

That single command:

1. **Detects your stack** — Prisma, Drizzle, or Knex; PostgreSQL, MySQL, or SQLite; your env setup.
2. **Installs the matching adapter packages** with your detected package manager (pass `--no-install` to print the install command instead).
3. **Writes `branchly.config.ts`** describing what it found.
4. **Installs the Git hooks** — `post-checkout` for provisioning and `post-merge` for cleanup offers, coexisting politely with Husky or a custom `core.hooksPath`.
5. **Gitignores** the local manifest and your env file.

## Connection detection

branchly never needs a new credential. It finds your existing connection — a `.env` file, Doppler, direnv, CI secrets, or your Prisma datasource — keeps the host and credentials, and just swaps the database name: a maintenance connection for creating and cloning databases, and a fresh `app_<branch>` database per branch.

## Requirements

- Node.js ≥ 22
- A Git repository
- A database your migrations already run against (PostgreSQL, MySQL, or SQLite out of the box)

## Share it with your team

Commit the generated `branchly.config.ts`. Teammates install branchly, run `branchly init` (it keeps an existing config), and inherit the exact same setup.

Next up: the [quickstart](/branchly/start/quickstart/).

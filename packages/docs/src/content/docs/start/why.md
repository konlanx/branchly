---
title: Why branchly?
description: The problem branchly solves — divergent migrations on a shared development database — and how it solves it.
---

When several Git branches carry different schema migrations, a single shared development database is constantly out of step with whatever you have checked out. Your migration tool notices the mismatch, calls it drift or a history conflict, and responds the only way it can: it resets the database. Your carefully arranged test data is gone, and you get to reseed. Again.

The fix isn't a feature of any one ORM. It's to give **each branch its own database state** and make moving between those states automatic and fast. That's branchly:

- **Each branch gets an isolated database.** Switching branches selects the matching one with zero manual steps.
- **First visits provision automatically** — create (or clone) → migrate → seed, triggered by the Git checkout itself.
- **Return visits are instant.** No migration, no seed, no waiting.
- **Snapshots make even first visits fast.** Fully migrated-and-seeded golden images are cached and cloned in well under a second.

## How it's different

Some excellent tools live nearby, but none fills this exact spot:

| Tool                                        | Why it's not quite this                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| pgsh                                        | Closest concept, but Knex-only, manual switching, and unmaintained since 2022.           |
| Neon / Supabase / PlanetScale branching     | Cloud-only; requires a hosted provider and doesn't run your migrations or seeds for you. |
| Snaplet seed                                | Complementary — it generates seed data, it doesn't switch branch state.                  |
| Hand-rolled Postgres clones + Git worktrees | A workflow, not a packaged tool.                                                         |

branchly is simultaneously **local-first**, **ORM-native** (it runs your real migrate and seed), **automatic on checkout**, and **fast via snapshot caching** — and it's **plugin-based**, so it isn't married to one stack.

## What branchly is not

branchly manages **development** databases only. It doesn't touch production or shared staging environments, it doesn't replace your ORM's migration authoring or your seed generator, and it doesn't sync databases between teammates. It does one thing: keeps your local branch and your local data moving together.

Ready? Head to [installation](/branchly/start/installation/).

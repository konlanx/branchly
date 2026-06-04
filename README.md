# branchly

A local-first, ORM- and database-agnostic tool that keeps each VCS branch paired
with its own database state, so switching branches never forces a manual reset/reseed.

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for the full architecture
specification and [CLAUDE.md](./CLAUDE.md) for coding style and verification conventions.

## Repository layout

This is a pnpm + TypeScript monorepo. Each axis of the design (migrator, datasource,
resolver, vcs) is a separate package, following the `M + N` plugin model.

```
packages/
├── core/        # the `branchly` package — kernel, CLI, and adapter interfaces
└── vcs-git/     # @branchly/vcs-git — reference VCS adapter (git)
```

## Development

```sh
pnpm install          # install dependencies and set up git hooks
pnpm run dev          # build all packages in watch mode
pnpm run lint         # ESLint across the workspace
pnpm run format       # format with Prettier
pnpm run typecheck    # typecheck every package
pnpm run test         # run the Vitest suite
pnpm run build        # build every package with tsup
```

Verification gates run automatically: **pre-commit** formats staged files and typechecks;
**pre-push** runs the test suite. The same gates run in CI on every pull request.

---
title: Writing a resolver
description: Implementing ConnectionResolver — making the per-branch connection visible to the app.
---

A resolver answers the last-mile question: _now that the right database exists, how does the app find it?_ It's the smallest axis — one method — and the easiest first adapter to write.

## The interface

```ts
interface ConnectionResolver {
  readonly id: string;
  readonly apiVersion: number;

  inject(connection: ConnectionString): Promise<void>;
}
```

## The contract

After `inject(connection)` resolves, a process started the way the project normally starts (reading `.env`, evaluating `.envrc`, whatever your mechanism is) must observe `connection` as the active database connection. Two practical implications:

- **Injection repeats on every switch**, so it must overwrite its previous value, not append a second one.
- **Be surgical.** If you write into a file the user also owns, upsert your one key and leave every other line untouched.

## A complete example

The real direnv resolver — upsert one `export` line into `.envrc`:

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ConnectionResolver } from 'branchly';

export interface DirenvResolverOptions {
  readonly file?: string;
  readonly key?: string;
  readonly cwd?: string;
}

export const upsertExport = (content: string, key: string, value: string): string => {
  const line = `export ${key}=${value}`;
  const existing = content.length === 0 ? [] : content.replace(/\n+$/, '').split('\n');
  const replaced = existing.map((current) => (current.startsWith(`export ${key}=`) ? line : current));
  const next = replaced.includes(line) ? replaced : [...replaced, line];
  return `${next.join('\n')}\n`;
};

const readExisting = (path: string): Promise<string> =>
  readFile(path, 'utf8').then(
    (content) => content,
    () => '',
  );

export const createDirenvResolver = (options: DirenvResolverOptions = {}): ConnectionResolver => {
  const path = join(options.cwd ?? '.', options.file ?? '.envrc');
  const key = options.key ?? 'DATABASE_URL';
  return {
    id: 'direnv',
    apiVersion: 1,
    inject: async (connection) => {
      const existing = await readExisting(path);
      await writeFile(path, upsertExport(existing, key, connection), 'utf8');
    },
  };
};

export default createDirenvResolver;
```

Note the `cwd` option: file-based resolvers should take one so tests can point them at a temp directory.

## Prove it

Wire up the [conformance kit](/branchly/authoring/test-kit/#testing-a-resolver) — you provide an `observe` function that reads the connection back the way an app would, and the kit verifies injection is observable and that a second `inject` overwrites the first.

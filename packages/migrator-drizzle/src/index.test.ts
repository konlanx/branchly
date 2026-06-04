import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDrizzleMigrator, fingerprintFiles } from './index';

describe('fingerprintFiles', () => {
  it('is deterministic regardless of order', () => {
    expect(fingerprintFiles(['0001_b.sql', '0000_a.sql'])).toBe(fingerprintFiles(['0000_a.sql', '0001_b.sql']));
  });

  it('changes when the migration set changes', () => {
    expect(fingerprintFiles(['0000_a.sql'])).not.toBe(fingerprintFiles(['0000_a.sql', '0001_b.sql']));
  });

  it('produces a short hex string', () => {
    expect(fingerprintFiles(['0000_a.sql'])).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('createDrizzleMigrator', () => {
  it('fingerprints the .sql files in the migrations directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-drizzle-'));
    try {
      await mkdir(join(root, 'drizzle', 'meta'), { recursive: true });
      await writeFile(join(root, 'drizzle', '0000_init.sql'), 'CREATE TABLE t (id int);', 'utf8');
      await writeFile(join(root, 'drizzle', 'meta', '_journal.json'), '{}', 'utf8');
      expect(await createDrizzleMigrator({ cwd: root }).fingerprint()).toMatch(/^[0-9a-f]{16}$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('applies migrations with the connection in the configured env var', async () => {
    const calls: { command: string; url: string | undefined }[] = [];
    const run = (command: string, env: NodeJS.ProcessEnv) => {
      calls.push({ command, url: env.DATABASE_URL });
      return Promise.resolve();
    };
    await createDrizzleMigrator({ run, cwd: '/tmp' }).apply('postgres://here/db');
    expect(calls).toEqual([{ command: 'npx drizzle-kit migrate', url: 'postgres://here/db' }]);
  });

  it('runs the configured seed command and skips it when unset', async () => {
    const commands: string[] = [];
    const run = (command: string) => {
      commands.push(command);
      return Promise.resolve();
    };
    await createDrizzleMigrator({ run, seed: 'tsx drizzle/seed.ts' }).seed('postgres://x');
    await createDrizzleMigrator({ run }).seed('postgres://x');
    expect(commands).toEqual(['tsx drizzle/seed.ts']);
  });
});

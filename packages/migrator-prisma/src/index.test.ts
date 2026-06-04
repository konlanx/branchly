import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createPrismaMigrator, fingerprintNames } from './index';

describe('fingerprintNames', () => {
  it('is deterministic regardless of order', () => {
    expect(fingerprintNames(['b', 'a'])).toBe(fingerprintNames(['a', 'b']));
  });

  it('changes when the migration set changes', () => {
    expect(fingerprintNames(['a'])).not.toBe(fingerprintNames(['a', 'b']));
  });

  it('produces a short hex string', () => {
    expect(fingerprintNames(['a'])).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('createPrismaMigrator', () => {
  it('fingerprints the migration directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-prisma-'));
    try {
      await mkdir(join(root, 'prisma', 'migrations', '20240101_init'), { recursive: true });
      await mkdir(join(root, 'prisma', 'migrations', '20240102_more'), { recursive: true });
      expect(await createPrismaMigrator({ cwd: root }).fingerprint()).toMatch(/^[0-9a-f]{16}$/);
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
    await createPrismaMigrator({ run, cwd: '/tmp' }).apply('postgres://here/db');
    expect(calls).toEqual([{ command: 'npx prisma migrate deploy', url: 'postgres://here/db' }]);
  });

  it('runs the configured seed command', async () => {
    const commands: string[] = [];
    const run = (command: string) => {
      commands.push(command);
      return Promise.resolve();
    };
    await createPrismaMigrator({ run, seed: 'tsx prisma/seed.ts' }).seed('postgres://x');
    expect(commands).toEqual(['tsx prisma/seed.ts']);
  });

  it('skips seeding when no seed command is configured', async () => {
    const commands: string[] = [];
    const run = (command: string) => {
      commands.push(command);
      return Promise.resolve();
    };
    await createPrismaMigrator({ run }).seed('postgres://x');
    expect(commands).toEqual([]);
  });
});

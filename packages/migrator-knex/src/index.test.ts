import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createKnexMigrator, fingerprintFiles } from './index';

describe('fingerprintFiles', () => {
  it('is deterministic regardless of order', () => {
    expect(fingerprintFiles(['20240102_users.js', '20240101_init.js'])).toBe(
      fingerprintFiles(['20240101_init.js', '20240102_users.js']),
    );
  });

  it('changes when the migration set changes', () => {
    expect(fingerprintFiles(['20240101_init.js'])).not.toBe(
      fingerprintFiles(['20240101_init.js', '20240102_users.js']),
    );
  });

  it('produces a short hex string', () => {
    expect(fingerprintFiles(['20240101_init.js'])).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('createKnexMigrator', () => {
  it('fingerprints only the migration files in the migrations directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-knex-'));
    try {
      await mkdir(join(root, 'migrations'), { recursive: true });
      await writeFile(join(root, 'migrations', '20240101_init.js'), 'module.exports = {};', 'utf8');
      await writeFile(join(root, 'migrations', '20240102_users.ts'), 'export {};', 'utf8');
      await writeFile(join(root, 'migrations', 'notes.md'), 'not a migration', 'utf8');
      const withStrayFile = await createKnexMigrator({ cwd: root }).fingerprint();
      expect(withStrayFile).toBe(fingerprintFiles(['20240101_init.js', '20240102_users.ts']));
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
    await createKnexMigrator({ run, cwd: '/tmp' }).apply('postgres://here/db');
    expect(calls).toEqual([{ command: 'npx knex migrate:latest', url: 'postgres://here/db' }]);
  });

  it('runs the configured seed command and skips it when unset', async () => {
    const commands: string[] = [];
    const run = (command: string) => {
      commands.push(command);
      return Promise.resolve();
    };
    await createKnexMigrator({ run, seed: 'npx knex seed:run' }).seed('postgres://x');
    await createKnexMigrator({ run }).seed('postgres://x');
    expect(commands).toEqual(['npx knex seed:run']);
  });
});

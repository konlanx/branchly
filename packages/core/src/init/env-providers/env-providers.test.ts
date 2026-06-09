import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { direnvProvider } from './direnv';
import { envFileProvider } from './env-file';
import { detectEnvProviders, providerById } from './index';
import { shellProvider } from './shell';
import type { CommandRunner, EnvProviderContext } from './types';

const KEY = 'DATABASE_URL';
const never: CommandRunner = () => Promise.resolve(false);
const always: CommandRunner = () => Promise.resolve(true);

const contextFor = (cwd: string, env: NodeJS.ProcessEnv, runCommand: CommandRunner): EnvProviderContext => ({
  cwd,
  env,
  key: KEY,
  runCommand,
});

const withDir = async (action: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-env-'));
  try {
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('shellProvider', () => {
  it('detects and verifies when the key is exported, and never wraps', async () => {
    await withDir(async (root) => {
      expect(await shellProvider.detect(contextFor(root, { DATABASE_URL: 'x' }, never))).toBe(true);
      expect(await shellProvider.verifyResolves(contextFor(root, { DATABASE_URL: 'x' }, never))).toBe(true);
      expect(await shellProvider.detect(contextFor(root, {}, never))).toBe(false);
      expect(shellProvider.wrapHookCommand('cmd')).toBe('cmd');
    });
  });
});

describe('envFileProvider', () => {
  it('detects the key from a .env file, including export form', async () => {
    await withDir(async (root) => {
      await writeFile(join(root, '.env'), 'export DATABASE_URL=postgres://localhost/app\n', 'utf8');
      expect(await envFileProvider.detect(contextFor(root, {}, never))).toBe(true);
      expect(await envFileProvider.verifyResolves(contextFor(root, {}, never))).toBe(true);
    });
  });

  it('does not detect when the .env is missing or lacks the key', async () => {
    await withDir(async (root) => {
      expect(await envFileProvider.detect(contextFor(root, {}, never))).toBe(false);
      await writeFile(join(root, '.env'), 'OTHER=1\n', 'utf8');
      expect(await envFileProvider.detect(contextFor(root, {}, never))).toBe(false);
    });
  });
});

describe('direnvProvider', () => {
  it('detects only when both .envrc and the direnv binary are present', async () => {
    await withDir(async (root) => {
      expect(await direnvProvider.detect(contextFor(root, {}, always))).toBe(false);
      await writeFile(join(root, '.envrc'), 'export DATABASE_URL=x\n', 'utf8');
      expect(await direnvProvider.detect(contextFor(root, {}, never))).toBe(false);
      expect(await direnvProvider.detect(contextFor(root, {}, always))).toBe(true);
    });
  });

  it('wraps the hook with direnv exec and verifies via the runner', async () => {
    await withDir(async (root) => {
      const seen: string[][] = [];
      const runner: CommandRunner = (command, args) => {
        seen.push([command, ...args]);
        return Promise.resolve(true);
      };
      expect(direnvProvider.wrapHookCommand('npx branchly on-checkout')).toBe('direnv exec . npx branchly on-checkout');
      expect(await direnvProvider.verifyResolves(contextFor(root, {}, runner))).toBe(true);
      expect(seen[0]?.slice(0, 2)).toEqual(['direnv', 'exec']);
    });
  });
});

describe('detectEnvProviders / providerById', () => {
  it('returns matches in priority order and resolves ids', async () => {
    await withDir(async (root) => {
      await writeFile(join(root, '.env'), 'DATABASE_URL=x\n', 'utf8');
      const detected = await detectEnvProviders(contextFor(root, { DATABASE_URL: 'x' }, never));
      expect(detected.map((provider) => provider.id)).toEqual(['env-file', 'shell']);
      expect(providerById('direnv')).toBe(direnvProvider);
      expect(providerById('nope')).toBeNull();
    });
  });
});

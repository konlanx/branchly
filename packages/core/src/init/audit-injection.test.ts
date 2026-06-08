import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditInjection, unwrappedInjectors } from './audit-injection';
import type { CommandRunner, EnvProviderContext } from './env-providers';

const KEY = 'DATABASE_URL';

const contextFor = (cwd: string, runCommand: CommandRunner): EnvProviderContext => ({
  cwd,
  env: {},
  key: KEY,
  runCommand,
});

const writeHook = async (root: string, content: string): Promise<void> => {
  await mkdir(join(root, '.git', 'hooks'), { recursive: true });
  await writeFile(join(root, '.git', 'hooks', 'post-checkout'), content, 'utf8');
};

const withDir = async (action: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-audit-'));
  try {
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('auditInjection', () => {
  it('flags a detected injector whose wrapper is missing from the hook', async () => {
    await withDir(async (root) => {
      await writeFile(join(root, 'doppler.yaml'), 'setup:\n', 'utf8');
      await writeHook(root, 'exec npx branchly on-checkout "$@"\n');
      const unwrapped = unwrappedInjectors(await auditInjection(contextFor(root, () => Promise.resolve(true))));
      expect(unwrapped.map((finding) => finding.provider.id)).toEqual(['doppler']);
    });
  });

  it('does not flag when the hook already carries the wrapper', async () => {
    await withDir(async (root) => {
      await writeFile(join(root, 'doppler.yaml'), 'setup:\n', 'utf8');
      await writeHook(root, 'exec doppler run -- npx branchly on-checkout "$@"\n');
      const unwrapped = unwrappedInjectors(await auditInjection(contextFor(root, () => Promise.resolve(true))));
      expect(unwrapped).toHaveLength(0);
    });
  });

  it('does not flag an injector that cannot resolve the key', async () => {
    await withDir(async (root) => {
      await writeFile(join(root, 'doppler.yaml'), 'setup:\n', 'utf8');
      await writeHook(root, 'exec npx branchly on-checkout "$@"\n');
      const runner: CommandRunner = (command, args) =>
        Promise.resolve(command === 'doppler' && args[0] === 'configure');
      const unwrapped = unwrappedInjectors(await auditInjection(contextFor(root, runner)));
      expect(unwrapped).toHaveLength(0);
    });
  });
});

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { type Installer, runInit } from './init';
import { createReporter } from '../runtime/reporter';

describe('runInit', () => {
  it('installs the detected adapters, writes a config, and installs the hook', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      const calls: { command: string; args: readonly string[] }[] = [];
      const installer: Installer = (command, args) => {
        calls.push({ command, args });
        return Promise.resolve();
      };

      await runInit({ cwd: root, reporter: createReporter({ quiet: true }), installer });

      expect(calls).toHaveLength(1);
      expect(calls[0]?.command).toBe('npm');
      expect(calls[0]?.args).toEqual([
        'install',
        '--save-dev',
        '@branchly/vcs-git',
        '@branchly/migrator-prisma',
        '@branchly/datasource-postgres',
        '@branchly/resolver-env-file',
      ]);
      expect(await readFile(join(root, 'branchly.config.ts'), 'utf8')).toContain('defineConfig');
      expect(await readFile(join(root, '.gitignore'), 'utf8')).toContain('.env');
      expect(await readFile(join(root, '.git', 'hooks', 'post-checkout'), 'utf8')).toContain('branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses the detected package manager', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      await writeFile(join(root, 'pnpm-lock.yaml'), '', 'utf8');
      const installer = vi.fn(() => Promise.resolve());
      await runInit({ cwd: root, reporter: createReporter({ quiet: true }), installer });
      expect(installer).toHaveBeenCalledWith('pnpm', expect.arrayContaining(['add', '--save-dev']), root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips installation with install: false', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      const installer = vi.fn(() => Promise.resolve());
      await runInit({ cwd: root, reporter: createReporter({ quiet: true }), install: false, installer });
      expect(installer).not.toHaveBeenCalled();
      expect(await readFile(join(root, 'branchly.config.ts'), 'utf8')).toContain('defineConfig');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

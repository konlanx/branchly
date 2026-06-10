import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { type Installer, runInit } from './init';
import type { CommandRunner } from '../init/env-providers';
import { createReporter } from '../runtime/reporter';

const noInjectors: CommandRunner = () => Promise.resolve(false);

const recordingInstaller = (): { calls: { command: string; args: readonly string[] }[]; installer: Installer } => {
  const calls: { command: string; args: readonly string[] }[] = [];
  const installer: Installer = (command, args) => {
    calls.push({ command, args });
    return Promise.resolve();
  };
  return { calls, installer };
};

describe('runInit', () => {
  it('installs the detected adapters, writes a config, and installs the hook', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      await writeFile(join(root, 'package-lock.json'), '{}', 'utf8');
      const { calls, installer } = recordingInstaller();

      await runInit({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        installer,
        env: {},
        interactive: false,
        runCommand: noInjectors,
      });

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
      expect(await readFile(join(root, '.git', 'hooks', 'post-merge'), 'utf8')).toContain('branchly post-merge');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('installs the mysql adapter and writes a mysql config when the database url is a mysql url', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      const { calls, installer } = recordingInstaller();

      await runInit({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        installer,
        env: { DATABASE_URL: 'mysql://root:pw@localhost:3306/app' },
        interactive: false,
        runCommand: noInjectors,
      });

      expect(calls[0]?.args).toContain('@branchly/datasource-mysql');
      expect(await readFile(join(root, 'branchly.config.ts'), 'utf8')).toContain("use: 'mysql'");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses the detected package manager', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      await writeFile(join(root, 'pnpm-lock.yaml'), '', 'utf8');
      const installer = vi.fn(() => Promise.resolve());
      await runInit({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        installer,
        env: {},
        interactive: false,
        runCommand: noInjectors,
      });
      expect(installer).toHaveBeenCalledWith('pnpm', expect.arrayContaining(['add', '--save-dev']), root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips installation with install: false', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      const installer = vi.fn(() => Promise.resolve());
      await runInit({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        install: false,
        installer,
        env: {},
        interactive: false,
        runCommand: noInjectors,
      });
      expect(installer).not.toHaveBeenCalled();
      expect(await readFile(join(root, 'branchly.config.ts'), 'utf8')).toContain('defineConfig');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('wraps the hooks with the chosen injector and verifies resolution', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      const { installer } = recordingInstaller();
      const ok = await runInit({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        installer,
        env: {},
        envProvider: 'direnv',
        runCommand: () => Promise.resolve(true),
      });
      expect(ok).toBe(true);
      const hook = await readFile(join(root, '.git', 'hooks', 'post-checkout'), 'utf8');
      expect(hook).toContain('direnv exec . ');
      expect(hook).toContain('branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('still scaffolds but reports failure when no env source can resolve the url', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      const { installer } = recordingInstaller();
      const ok = await runInit({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        installer,
        env: {},
        interactive: false,
        runCommand: noInjectors,
      });
      expect(ok).toBe(false);
      const hook = await readFile(join(root, '.git', 'hooks', 'post-checkout'), 'utf8');
      expect(hook).toContain('branchly on-checkout');
      expect(hook).not.toContain('direnv exec');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('selects the env-file injector when a .env defines the key', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      await writeFile(join(root, '.env'), 'DATABASE_URL=postgres://localhost/app\n', 'utf8');
      const { installer } = recordingInstaller();
      const ok = await runInit({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        installer,
        env: {},
        interactive: false,
        runCommand: noInjectors,
      });
      expect(ok).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

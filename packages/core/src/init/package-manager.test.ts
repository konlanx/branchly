import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectPackageManager, installArgs } from './package-manager';

const withLockfile = async (file: string | null, action: (cwd: string) => Promise<void>): Promise<void> => {
  const cwd = await mkdtemp(join(tmpdir(), 'branchly-pm-'));
  try {
    if (file !== null) {
      await writeFile(join(cwd, file), '', 'utf8');
    }
    await action(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
};

describe('detectPackageManager', () => {
  it('detects pnpm from its lockfile', async () => {
    await withLockfile('pnpm-lock.yaml', async (cwd) => {
      expect(await detectPackageManager(cwd)).toBe('pnpm');
    });
  });

  it('detects yarn from its lockfile', async () => {
    await withLockfile('yarn.lock', async (cwd) => {
      expect(await detectPackageManager(cwd)).toBe('yarn');
    });
  });

  it('falls back to npm when no lockfile is present', async () => {
    await withLockfile(null, async (cwd) => {
      expect(await detectPackageManager(cwd)).toBe('npm');
    });
  });
});

describe('installArgs', () => {
  it('builds an npm dev-install command', () => {
    expect(installArgs('npm', ['branchly'])).toEqual(['install', '--save-dev', 'branchly']);
  });

  it('builds a pnpm dev-install command', () => {
    expect(installArgs('pnpm', ['a', 'b'])).toEqual(['add', '--save-dev', 'a', 'b']);
  });

  it('builds a yarn dev-install command', () => {
    expect(installArgs('yarn', ['a'])).toEqual(['add', '--dev', 'a']);
  });
});

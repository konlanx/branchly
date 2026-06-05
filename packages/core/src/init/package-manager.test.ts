import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectPackageManager, installArgs } from './package-manager';

const withTemp = async (action: (dir: string) => Promise<void>): Promise<void> => {
  const dir = await mkdtemp(join(tmpdir(), 'branchly-pm-'));
  try {
    await action(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

describe('detectPackageManager', () => {
  it('detects pnpm from a lockfile in the directory', async () => {
    await withTemp(async (dir) => {
      await writeFile(join(dir, 'pnpm-lock.yaml'), '', 'utf8');
      expect(await detectPackageManager(dir, '')).toBe('pnpm');
    });
  });

  it('detects yarn from a lockfile in a parent directory (monorepo)', async () => {
    await withTemp(async (root) => {
      await writeFile(join(root, 'yarn.lock'), '', 'utf8');
      const pkg = join(root, 'packages', 'api');
      await mkdir(pkg, { recursive: true });
      expect(await detectPackageManager(pkg, '')).toBe('yarn');
    });
  });

  it('falls back to the invoking package manager when no lockfile exists', async () => {
    await withTemp(async (dir) => {
      expect(await detectPackageManager(dir, 'yarn/4.14.1 npm/? node/v24.0.0')).toBe('yarn');
    });
  });

  it('falls back to npm when there is neither a lockfile nor a known user agent', async () => {
    await withTemp(async (dir) => {
      expect(await detectPackageManager(dir, '')).toBe('npm');
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

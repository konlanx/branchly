import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendHookLine,
  hasBranchlyHook,
  hookCommand,
  hookTarget,
  installHook,
  POST_CHECKOUT_HOOK,
  POST_MERGE_HOOK,
  renderHookFile,
} from './hook';

describe('hookCommand', () => {
  it('returns the plain command without doppler', () => {
    expect(hookCommand(POST_CHECKOUT_HOOK, false, 'npm')).toBe('npx branchly on-checkout "$@"');
  });

  it('wraps the command with doppler run', () => {
    expect(hookCommand(POST_CHECKOUT_HOOK, true, 'npm')).toBe('doppler run -- npx branchly on-checkout "$@"');
  });

  it('uses the spec subcommand for other hooks', () => {
    expect(hookCommand(POST_MERGE_HOOK, false, 'npm')).toBe('npx branchly post-merge "$@"');
  });

  it('uses the runner that matches the package manager', () => {
    expect(hookCommand(POST_CHECKOUT_HOOK, false, 'pnpm')).toBe('pnpm exec branchly on-checkout "$@"');
    expect(hookCommand(POST_CHECKOUT_HOOK, false, 'yarn')).toBe('yarn branchly on-checkout "$@"');
    expect(hookCommand(POST_CHECKOUT_HOOK, false, 'bun')).toBe('bunx branchly on-checkout "$@"');
  });
});

describe('hookTarget', () => {
  it('uses .git/hooks when no hooks path is set', () => {
    expect(hookTarget('/repo', null, 'post-checkout')).toEqual({
      path: join('/repo', '.git', 'hooks', 'post-checkout'),
      managed: false,
    });
  });

  it('uses .husky for a husky hooks path', () => {
    expect(hookTarget('/repo', '.husky/_', 'post-merge')).toEqual({
      path: join('/repo', '.husky', 'post-merge'),
      managed: true,
    });
  });

  it('uses a custom relative hooks path', () => {
    expect(hookTarget('/repo', 'config/hooks', 'post-checkout')).toEqual({
      path: join('/repo', 'config', 'hooks', 'post-checkout'),
      managed: false,
    });
  });
});

describe('renderHookFile', () => {
  it('renders a managed (husky) hook as just the command', () => {
    expect(renderHookFile('npx branchly on-checkout "$@"', true)).toBe('npx branchly on-checkout "$@"\n');
  });

  it('renders a raw hook with a shebang and the spec guard', () => {
    const content = renderHookFile('npx branchly on-checkout "$@"', false, POST_CHECKOUT_HOOK.guard);
    expect(content).toContain('#!/usr/bin/env sh');
    expect(content).toContain('[ "$3" = "1" ] || exit 0');
    expect(content).toContain('exec npx branchly on-checkout "$@"');
  });

  it('renders a raw hook without a guard line when the spec has none', () => {
    const content = renderHookFile('npx branchly post-merge "$@"', false, POST_MERGE_HOOK.guard);
    expect(content).toBe('#!/usr/bin/env sh\nexec npx branchly post-merge "$@"\n');
  });
});

describe('appendHookLine / hasBranchlyHook', () => {
  it('appends a command, fixing a missing trailing newline', () => {
    expect(appendHookLine('echo hi', 'npx branchly on-checkout "$@"')).toBe('echo hi\nnpx branchly on-checkout "$@"\n');
  });

  it('detects an existing branchly hook for the given spec', () => {
    expect(hasBranchlyHook('echo hi\nnpx branchly on-checkout "$@"\n', POST_CHECKOUT_HOOK)).toBe(true);
    expect(hasBranchlyHook('echo hi\nnpx branchly on-checkout "$@"\n', POST_MERGE_HOOK)).toBe(false);
    expect(hasBranchlyHook('echo hi\n', POST_CHECKOUT_HOOK)).toBe(false);
  });
});

describe('installHook', () => {
  it('installs a raw post-checkout hook in .git/hooks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installHook(root, POST_CHECKOUT_HOOK, { hooksPath: null, doppler: false, manager: 'npm' });
      expect(result.status).toBe('installed');
      expect(result.path).toBe(join(root, '.git', 'hooks', 'post-checkout'));
      const content = await readFile(result.path, 'utf8');
      expect(content).toContain('exec npx branchly on-checkout');
      expect(content).toContain('[ "$3" = "1" ] || exit 0');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('installs a raw post-merge hook without a checkout guard', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installHook(root, POST_MERGE_HOOK, { hooksPath: null, doppler: false, manager: 'npm' });
      expect(result.path).toBe(join(root, '.git', 'hooks', 'post-merge'));
      const content = await readFile(result.path, 'utf8');
      expect(content).toContain('exec npx branchly post-merge');
      expect(content).not.toContain('"$3"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('installs a husky hook at .husky/post-checkout without a shebang', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installHook(root, POST_CHECKOUT_HOOK, {
        hooksPath: '.husky/_',
        doppler: false,
        manager: 'npm',
      });
      expect(result.path).toBe(join(root, '.husky', 'post-checkout'));
      expect(await readFile(result.path, 'utf8')).toBe('npx branchly on-checkout "$@"\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('wraps the hook with doppler run when Doppler is detected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installHook(root, POST_CHECKOUT_HOOK, { hooksPath: null, doppler: true, manager: 'npm' });
      expect(result.doppler).toBe(true);
      expect(await readFile(result.path, 'utf8')).toContain('doppler run -- npx branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('chains onto an existing foreign hook instead of overwriting it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      await installHook(root, POST_CHECKOUT_HOOK, { hooksPath: '.husky/_', doppler: false, manager: 'npm' });
      await writeFile(join(root, '.husky', 'post-checkout'), 'echo existing\n', 'utf8');
      const result = await installHook(root, POST_CHECKOUT_HOOK, {
        hooksPath: '.husky/_',
        doppler: false,
        manager: 'npm',
      });
      expect(result.status).toBe('chained');
      const content = await readFile(result.path, 'utf8');
      expect(content).toContain('echo existing');
      expect(content).toContain('npx branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('is idempotent when a branchly hook is already present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      await installHook(root, POST_CHECKOUT_HOOK, { hooksPath: null, doppler: false, manager: 'npm' });
      const result = await installHook(root, POST_CHECKOUT_HOOK, { hooksPath: null, doppler: false, manager: 'npm' });
      expect(result.status).toBe('present');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('writes the runner for the given package manager', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installHook(root, POST_CHECKOUT_HOOK, {
        hooksPath: '.husky/_',
        doppler: false,
        manager: 'yarn',
      });
      expect(await readFile(result.path, 'utf8')).toBe('yarn branchly on-checkout "$@"\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('detects the package manager from a lockfile when none is given', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      await writeFile(join(root, 'pnpm-lock.yaml'), '', 'utf8');
      const result = await installHook(root, POST_CHECKOUT_HOOK, { hooksPath: '.husky/_', doppler: false });
      expect(await readFile(result.path, 'utf8')).toBe('pnpm exec branchly on-checkout "$@"\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

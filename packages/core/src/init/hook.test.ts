import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  appendHookLine,
  hasBranchlyHook,
  hookCommand,
  hookTarget,
  installPostCheckoutHook,
  renderHookFile,
} from './hook';

describe('hookCommand', () => {
  it('returns the plain command without doppler', () => {
    expect(hookCommand(false)).toBe('npx branchly on-checkout "$@"');
  });

  it('wraps the command with doppler run', () => {
    expect(hookCommand(true)).toBe('doppler run -- npx branchly on-checkout "$@"');
  });
});

describe('hookTarget', () => {
  it('uses .git/hooks when no hooks path is set', () => {
    expect(hookTarget('/repo', null)).toEqual({ path: '/repo/.git/hooks/post-checkout', managed: false });
  });

  it('uses .husky for a husky hooks path', () => {
    expect(hookTarget('/repo', '.husky/_')).toEqual({ path: '/repo/.husky/post-checkout', managed: true });
  });

  it('uses a custom relative hooks path', () => {
    expect(hookTarget('/repo', 'config/hooks')).toEqual({ path: '/repo/config/hooks/post-checkout', managed: false });
  });
});

describe('renderHookFile', () => {
  it('renders a managed (husky) hook as just the command', () => {
    expect(renderHookFile('npx branchly on-checkout "$@"', true)).toBe('npx branchly on-checkout "$@"\n');
  });

  it('renders a raw hook with a shebang and a branch-only guard', () => {
    const content = renderHookFile('npx branchly on-checkout "$@"', false);
    expect(content).toContain('#!/usr/bin/env sh');
    expect(content).toContain('[ "$3" = "1" ] || exit 0');
    expect(content).toContain('exec npx branchly on-checkout "$@"');
  });
});

describe('appendHookLine / hasBranchlyHook', () => {
  it('appends a command, fixing a missing trailing newline', () => {
    expect(appendHookLine('echo hi', 'npx branchly on-checkout "$@"')).toBe('echo hi\nnpx branchly on-checkout "$@"\n');
  });

  it('detects an existing branchly hook', () => {
    expect(hasBranchlyHook('echo hi\nnpx branchly on-checkout "$@"\n')).toBe(true);
    expect(hasBranchlyHook('echo hi\n')).toBe(false);
  });
});

describe('installPostCheckoutHook', () => {
  it('installs a raw hook in .git/hooks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installPostCheckoutHook(root, { hooksPath: null, doppler: false });
      expect(result.status).toBe('installed');
      expect(result.path).toBe(join(root, '.git', 'hooks', 'post-checkout'));
      expect(await readFile(result.path, 'utf8')).toContain('exec npx branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('installs a husky hook at .husky/post-checkout without a shebang', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installPostCheckoutHook(root, { hooksPath: '.husky/_', doppler: false });
      expect(result.path).toBe(join(root, '.husky', 'post-checkout'));
      expect(await readFile(result.path, 'utf8')).toBe('npx branchly on-checkout "$@"\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('wraps the hook with doppler run when Doppler is detected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      const result = await installPostCheckoutHook(root, { hooksPath: null, doppler: true });
      expect(result.doppler).toBe(true);
      expect(await readFile(result.path, 'utf8')).toContain('doppler run -- npx branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('chains onto an existing foreign hook instead of overwriting it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      await installPostCheckoutHook(root, { hooksPath: '.husky/_', doppler: false });
      await writeFile(join(root, '.husky', 'post-checkout'), 'echo existing\n', 'utf8');
      const result = await installPostCheckoutHook(root, { hooksPath: '.husky/_', doppler: false });
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
      await installPostCheckoutHook(root, { hooksPath: null, doppler: false });
      const result = await installPostCheckoutHook(root, { hooksPath: null, doppler: false });
      expect(result.status).toBe('present');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

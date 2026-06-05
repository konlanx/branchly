import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { createGitVcs } from './index';

const execFileAsync = promisify(execFile);

const git = (cwd: string, args: readonly string[]): Promise<unknown> =>
  execFileAsync('git', ['-c', 'user.email=branchly@test', '-c', 'user.name=branchly', ...args], { cwd });

const initRepo = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-git-'));
  await git(root, ['init', '-b', 'main']);
  await git(root, ['commit', '--allow-empty', '-m', 'init']);
  return root;
};

describe('createGitVcs', () => {
  it('exposes the git adapter identity', () => {
    const vcs = createGitVcs();
    expect(vcs.id).toBe('git');
    expect(vcs.apiVersion).toBe(1);
  });

  it('reports the current branch', async () => {
    const root = await initRepo();
    try {
      expect(await createGitVcs({ cwd: root }).currentRef()).toBe('main');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('lists the local branches', async () => {
    const root = await initRepo();
    try {
      await git(root, ['branch', 'feature/x']);
      const refs = await createGitVcs({ cwd: root }).liveRefs?.();
      expect(refs).toEqual(expect.arrayContaining(['main', 'feature/x']));
      expect(refs).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('lists branches merged into HEAD, excluding the current one', async () => {
    const root = await initRepo();
    try {
      await git(root, ['checkout', '-b', 'feature/merged']);
      await git(root, ['commit', '--allow-empty', '-m', 'feature work']);
      await git(root, ['checkout', 'main']);
      await git(root, ['merge', '--no-ff', '-m', 'merge feature', 'feature/merged']);
      await git(root, ['checkout', '-b', 'feature/active']);
      await git(root, ['commit', '--allow-empty', '-m', 'ongoing work']);
      await git(root, ['checkout', 'main']);

      const refs = await createGitVcs({ cwd: root }).mergedRefs?.();
      expect(refs).toEqual(['feature/merged']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('resolves the same state directory from the main worktree and a linked worktree', async () => {
    const base = await mkdtemp(join(tmpdir(), 'branchly-wt-'));
    const root = join(base, 'repo');
    const worktree = join(base, 'wt');
    try {
      await mkdir(root, { recursive: true });
      await git(root, ['init', '-b', 'main']);
      await git(root, ['commit', '--allow-empty', '-m', 'init']);
      await git(root, ['worktree', 'add', '-b', 'feature', worktree]);

      const mainState = await createGitVcs({ cwd: root }).stateDir?.();
      const worktreeState = await createGitVcs({ cwd: worktree }).stateDir?.();
      if (mainState === undefined || worktreeState === undefined) {
        throw new Error('stateDir is not implemented');
      }
      expect(await realpath(dirname(mainState))).toBe(await realpath(dirname(worktreeState)));
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});

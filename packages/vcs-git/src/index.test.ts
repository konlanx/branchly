import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
});

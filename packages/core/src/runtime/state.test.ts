import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { Vcs } from '../interfaces';
import { resolveManifestPath } from './state';

const baseVcs: Vcs = { id: 'fake', apiVersion: 1, currentRef: () => Promise.resolve('main') };

describe('resolveManifestPath', () => {
  it('uses the VCS state directory when one is provided', async () => {
    const vcs: Vcs = { ...baseVcs, stateDir: () => Promise.resolve('/repo/.git/branchly') };
    expect(await resolveManifestPath(vcs, '/repo/worktree')).toBe(join('/repo/.git/branchly', 'manifest.json'));
  });

  it('falls back to a working-tree .branchly directory when the VCS has no state directory', async () => {
    expect(await resolveManifestPath(baseVcs, '/repo')).toBe(join('/repo', '.branchly', 'manifest.json'));
  });
});

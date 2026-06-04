import { describe, expect, it } from 'vitest';

import { createGitVcs } from './index';

describe('createGitVcs', () => {
  it('exposes the git adapter identity', () => {
    const vcs = createGitVcs();
    expect(vcs.id).toBe('git');
    expect(vcs.apiVersion).toBe(1);
  });
});

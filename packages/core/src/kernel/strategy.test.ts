import { describe, expect, it } from 'vitest';

import { negotiateStrategy } from './strategy';

describe('negotiateStrategy', () => {
  it('clones from a snapshot when both capabilities are present', () => {
    expect(negotiateStrategy({ instantClone: true, snapshot: true, isolatedPerBranch: true })).toEqual({
      clone: true,
      snapshot: true,
      label: 'clone-from-snapshot',
    });
  });

  it('clones from an ancestor when only instant clone is present', () => {
    expect(negotiateStrategy({ instantClone: true, snapshot: false, isolatedPerBranch: true })).toEqual({
      clone: true,
      snapshot: false,
      label: 'clone-from-ancestor',
    });
  });

  it('creates only when no clone capability is present', () => {
    expect(negotiateStrategy({ instantClone: false, snapshot: false, isolatedPerBranch: true })).toEqual({
      clone: false,
      snapshot: false,
      label: 'create-only',
    });
  });
});

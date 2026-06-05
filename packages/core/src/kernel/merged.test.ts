import { describe, expect, it } from 'vitest';

import type { ManifestEntry } from '../manifest';
import { selectMerged } from './merged';

const entryFor = (ref: string): ManifestEntry => ({
  key: `${ref}__fp`,
  ref,
  slug: ref,
  fingerprint: 'fp',
  createdAt: 't',
});

describe('selectMerged', () => {
  it('selects manifest entries whose branch was merged into the current one', () => {
    const entries = [entryFor('main'), entryFor('feature/done'), entryFor('feature/active')];
    const selected = selectMerged(entries, ['feature/done'], ['main'], 'main');
    expect(selected.map((entry) => entry.ref)).toEqual(['feature/done']);
  });

  it('never selects a protected branch even when it is merged', () => {
    const entries = [entryFor('main'), entryFor('feature/done')];
    const selected = selectMerged(entries, ['main', 'feature/done'], ['main'], 'feature/active');
    expect(selected.map((entry) => entry.ref)).toEqual(['feature/done']);
  });

  it('never selects the current branch', () => {
    const entries = [entryFor('feature/active')];
    const selected = selectMerged(entries, ['feature/active'], [], 'feature/active');
    expect(selected).toEqual([]);
  });

  it('ignores merged branches that branchly never provisioned', () => {
    const entries = [entryFor('feature/tracked')];
    const selected = selectMerged(entries, ['feature/tracked', 'feature/untracked'], [], 'main');
    expect(selected.map((entry) => entry.ref)).toEqual(['feature/tracked']);
  });
});

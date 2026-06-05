import { describe, expect, it } from 'vitest';

import type { ManifestEntry } from '../manifest';
import { selectPrunable } from './prune';

const entry = (ref: string): ManifestEntry => ({
  key: `${ref}__fp`,
  ref,
  slug: ref,
  fingerprint: 'fp',
  createdAt: 't',
});

describe('selectPrunable', () => {
  it('selects entries whose ref is no longer live', () => {
    const entries = [entry('main'), entry('gone')];
    expect(selectPrunable(entries, ['main'], []).map((item) => item.ref)).toEqual(['gone']);
  });

  it('never selects a protected ref even when it is not live', () => {
    const entries = [entry('production'), entry('gone')];
    expect(selectPrunable(entries, [], ['production']).map((item) => item.ref)).toEqual(['gone']);
  });

  it('selects nothing when every ref is live', () => {
    const entries = [entry('main'), entry('feature')];
    expect(selectPrunable(entries, ['main', 'feature'], [])).toEqual([]);
  });
});

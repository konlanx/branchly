import { describe, expect, it } from 'vitest';

import { pickCloneSource } from './clone-source';

const candidates = [
  { key: 'main__fp1', slug: 'main', fingerprint: 'fp1' },
  { key: 'dev__fp2', slug: 'dev', fingerprint: 'fp2' },
];

describe('pickCloneSource', () => {
  it('prefers an exact fingerprint match', () => {
    expect(pickCloneSource(candidates, 'fp2', 'main')).toBe('dev__fp2');
  });

  it('falls back to the configured base slug', () => {
    expect(pickCloneSource(candidates, 'fp9', 'main')).toBe('main__fp1');
  });

  it('returns null when neither fingerprint nor base matches', () => {
    expect(pickCloneSource(candidates, 'fp9', 'release')).toBeNull();
  });

  it('returns null when there are no candidates', () => {
    expect(pickCloneSource([], 'fp1', 'main')).toBeNull();
  });
});

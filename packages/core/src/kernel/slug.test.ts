import { describe, expect, it } from 'vitest';

import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and collapses non-alphanumerics to underscores', () => {
    expect(slugify('Feature/My-Branch')).toBe('feature_my_branch');
  });

  it('trims leading and trailing underscores', () => {
    expect(slugify('--hotfix--')).toBe('hotfix');
  });

  it('caps the length', () => {
    expect(slugify('a'.repeat(100))).toHaveLength(48);
  });
});

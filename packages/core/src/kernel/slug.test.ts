import { describe, expect, it } from 'vitest';

import { resolveSlug, slugify } from './slug';

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

describe('resolveSlug', () => {
  it('returns the plain slug when there is no collision', () => {
    expect(resolveSlug('feature/x', new Set())).toBe('feature_x');
  });

  it('appends a deterministic hash suffix on collision', () => {
    const existing = new Set(['feature_x']);
    const first = resolveSlug('feature/x', existing);
    const second = resolveSlug('feature/x', existing);
    expect(first).toBe(second);
    expect(first).not.toBe('feature_x');
    expect(first.startsWith('feature_x_')).toBe(true);
  });

  it('keeps the collision-resolved slug within the length cap', () => {
    const longRef = 'a'.repeat(100);
    const resolved = resolveSlug(longRef, new Set([slugify(longRef)]));
    expect(resolved.length).toBeLessThanOrEqual(48);
  });

  it('gives different refs that collapse to the same base distinct slugs', () => {
    const existing = new Set(['feature_x']);
    expect(resolveSlug('feature/x', existing)).not.toBe(resolveSlug('feature-x', existing));
  });
});

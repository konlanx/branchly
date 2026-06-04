import { describe, expect, it } from 'vitest';

import { makeKey } from './key';

describe('makeKey', () => {
  it('is deterministic for the same inputs', () => {
    expect(makeKey('main', 'abc123')).toBe(makeKey('main', 'abc123'));
  });

  it('separates the slug and fingerprint', () => {
    expect(makeKey('main', 'abc123')).toBe('main__abc123');
  });

  it('distinguishes different fingerprints', () => {
    expect(makeKey('main', 'abc')).not.toBe(makeKey('main', 'def'));
  });

  it('distinguishes different slugs', () => {
    expect(makeKey('main', 'abc')).not.toBe(makeKey('dev', 'abc'));
  });
});

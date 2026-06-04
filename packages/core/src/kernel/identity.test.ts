import { describe, expect, it } from 'vitest';

import { emptyManifest, recordEntry } from '../manifest';
import { keyForRef, slugForRef } from './identity';

const entry = (ref: string, slug: string) => ({ key: `${slug}__fp`, ref, slug, fingerprint: 'fp', createdAt: 't' });

describe('slugForRef', () => {
  it('reuses a previously assigned slug for a known ref', () => {
    const manifest = recordEntry(emptyManifest(), entry('feature/x', 'x'));
    expect(slugForRef(manifest, 'feature/x')).toBe('x');
  });

  it('assigns a fresh slug for a new ref', () => {
    expect(slugForRef(emptyManifest(), 'feature/y')).toBe('feature_y');
  });

  it('suffixes on collision with a different ref', () => {
    const manifest = recordEntry(emptyManifest(), entry('feature/x', 'feature_x'));
    expect(slugForRef(manifest, 'feature-x')).not.toBe('feature_x');
  });
});

describe('keyForRef', () => {
  it('combines slug and fingerprint', () => {
    expect(keyForRef(emptyManifest(), 'main', 'fp1')).toBe('main__fp1');
  });
});

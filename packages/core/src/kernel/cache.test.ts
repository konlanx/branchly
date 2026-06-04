import { describe, expect, it } from 'vitest';

import type { SnapshotEntry } from '../manifest';
import { evictSnapshots, snapshotKeyFor } from './cache';

const snapshot = (fingerprint: string, clonedAt: string): SnapshotEntry => ({
  key: snapshotKeyFor(fingerprint),
  fingerprint,
  createdAt: clonedAt,
  clonedAt,
});

describe('snapshotKeyFor', () => {
  it('derives a reserved, collision-safe key from the fingerprint', () => {
    expect(snapshotKeyFor('abc')).toBe('__snapshot__abc');
  });
});

describe('evictSnapshots', () => {
  it('keeps everything within the limit', () => {
    const snapshots = [snapshot('a', 't1'), snapshot('b', 't2')];
    expect(evictSnapshots(snapshots, 5, undefined)).toEqual({ kept: snapshots, evicted: [] });
  });

  it('evicts the least-recently-cloned snapshots beyond the limit', () => {
    const snapshots = [snapshot('a', 't3'), snapshot('b', 't1'), snapshot('c', 't2')];
    const result = evictSnapshots(snapshots, 1, undefined);
    expect(result.evicted.map((entry) => entry.fingerprint)).toEqual(['b', 'c']);
    expect(result.kept.map((entry) => entry.fingerprint)).toEqual(['a']);
  });

  it('never evicts the protected (base) fingerprint', () => {
    const snapshots = [snapshot('base', 't1'), snapshot('other', 't2')];
    const result = evictSnapshots(snapshots, 1, 'base');
    expect(result.evicted.map((entry) => entry.fingerprint)).toEqual(['other']);
    expect(result.kept.map((entry) => entry.fingerprint)).toEqual(['base']);
  });
});

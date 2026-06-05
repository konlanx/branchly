import { describe, expect, it } from 'vitest';

import type { ManifestEntry } from '../manifest';
import { resolvePrunePolicy, selectStale, shouldSweep } from './sweep';

const DAY_MS = 24 * 60 * 60 * 1000;

const entryFor = (ref: string, lastUsedAt?: string): ManifestEntry => ({
  key: `${ref}__fp`,
  ref,
  slug: ref,
  fingerprint: 'fp',
  createdAt: '2026-01-01T00:00:00.000Z',
  lastUsedAt,
});

describe('resolvePrunePolicy', () => {
  it('applies friendly defaults when no prune config is set', () => {
    expect(resolvePrunePolicy(undefined)).toEqual({ autoDropDeleted: true, maxAgeMs: 30 * DAY_MS, nudge: true });
  });

  it('honours explicit overrides', () => {
    expect(resolvePrunePolicy({ autoDropDeleted: false, maxAgeDays: 7, nudge: false })).toEqual({
      autoDropDeleted: false,
      maxAgeMs: 7 * DAY_MS,
      nudge: false,
    });
  });
});

describe('shouldSweep', () => {
  it('sweeps when it has never swept before', () => {
    expect(shouldSweep(undefined, '2026-06-05T00:00:00.000Z', DAY_MS)).toBe(true);
  });

  it('sweeps once the interval has elapsed', () => {
    expect(shouldSweep('2026-06-03T00:00:00.000Z', '2026-06-05T00:00:00.000Z', DAY_MS)).toBe(true);
  });

  it('skips while still within the interval', () => {
    expect(shouldSweep('2026-06-05T00:00:00.000Z', '2026-06-05T06:00:00.000Z', DAY_MS)).toBe(false);
  });
});

describe('selectStale', () => {
  const now = '2026-06-05T00:00:00.000Z';
  const maxAgeMs = 30 * DAY_MS;

  it('selects alive branches untouched for longer than the max age', () => {
    const entries = [
      entryFor('feature/old', '2026-01-01T00:00:00.000Z'),
      entryFor('feature/fresh', '2026-06-04T00:00:00.000Z'),
    ];
    const selected = selectStale(entries, ['feature/old', 'feature/fresh'], [], 'main', now, maxAgeMs);
    expect(selected.map((entry) => entry.ref)).toEqual(['feature/old']);
  });

  it('falls back to createdAt when a branch has never recorded a visit', () => {
    const selected = selectStale([entryFor('feature/legacy')], ['feature/legacy'], [], 'main', now, maxAgeMs);
    expect(selected.map((entry) => entry.ref)).toEqual(['feature/legacy']);
  });

  it('ignores deleted branches, the current branch, and protected branches', () => {
    const entries = [
      entryFor('feature/deleted', '2026-01-01T00:00:00.000Z'),
      entryFor('feature/current', '2026-01-01T00:00:00.000Z'),
      entryFor('main', '2026-01-01T00:00:00.000Z'),
    ];
    const selected = selectStale(entries, ['feature/current', 'main'], ['main'], 'feature/current', now, maxAgeMs);
    expect(selected).toEqual([]);
  });
});

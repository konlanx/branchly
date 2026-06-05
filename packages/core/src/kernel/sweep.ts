import type { PruneConfig } from '../config';
import type { ManifestEntry } from '../manifest';

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_MAX_AGE_DAYS = 30;
export const SWEEP_INTERVAL_MS = DAY_MS;

export interface PrunePolicy {
  readonly autoDropDeleted: boolean;
  readonly maxAgeMs: number;
  readonly nudge: boolean;
}

export const resolvePrunePolicy = (config: PruneConfig | undefined): PrunePolicy => ({
  autoDropDeleted: config?.autoDropDeleted ?? true,
  maxAgeMs: (config?.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS) * DAY_MS,
  nudge: config?.nudge ?? true,
});

export const shouldSweep = (lastSweptAt: string | undefined, now: string, intervalMs: number): boolean => {
  if (lastSweptAt === undefined) {
    return true;
  }
  return Date.parse(now) - Date.parse(lastSweptAt) >= intervalMs;
};

const lastTouched = (entry: ManifestEntry): string => entry.lastUsedAt ?? entry.createdAt;

const isStale = (entry: ManifestEntry, now: string, maxAgeMs: number): boolean =>
  Date.parse(now) - Date.parse(lastTouched(entry)) >= maxAgeMs;

export const selectStale = (
  entries: readonly ManifestEntry[],
  liveRefs: readonly string[],
  protect: readonly string[],
  currentRef: string,
  now: string,
  maxAgeMs: number,
): readonly ManifestEntry[] => {
  const live = new Set(liveRefs);
  const guarded = new Set(protect);
  return entries.filter(
    (entry) =>
      live.has(entry.ref) && !guarded.has(entry.ref) && entry.ref !== currentRef && isStale(entry, now, maxAgeMs),
  );
};

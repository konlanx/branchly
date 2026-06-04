import type { BranchKey } from '../interfaces';
import type { SnapshotEntry } from '../manifest';
import { makeKey } from './key';

const SNAPSHOT_SLUG = '__snapshot';

export const snapshotKeyFor = (fingerprint: string): BranchKey => makeKey(SNAPSHOT_SLUG, fingerprint);

export interface EvictionResult {
  readonly kept: readonly SnapshotEntry[];
  readonly evicted: readonly SnapshotEntry[];
}

export const evictSnapshots = (
  snapshots: readonly SnapshotEntry[],
  max: number,
  protectedFingerprint: string | undefined,
): EvictionResult => {
  if (snapshots.length <= max) {
    return { kept: snapshots, evicted: [] };
  }
  const removable = [...snapshots]
    .filter((snapshot) => snapshot.fingerprint !== protectedFingerprint)
    .sort((left, right) => left.clonedAt.localeCompare(right.clonedAt));
  const evictedKeys = new Set(removable.slice(0, snapshots.length - max).map((snapshot) => snapshot.key));
  return {
    kept: snapshots.filter((snapshot) => !evictedKeys.has(snapshot.key)),
    evicted: snapshots.filter((snapshot) => evictedKeys.has(snapshot.key)),
  };
};

import type { BranchKey } from '../interfaces';

export interface CloneCandidate {
  readonly key: BranchKey;
  readonly slug: string;
  readonly fingerprint: string;
}

export interface SnapshotRef {
  readonly key: BranchKey;
  readonly fingerprint: string;
}

export const pickCloneSource = (
  snapshots: readonly SnapshotRef[],
  candidates: readonly CloneCandidate[],
  fingerprint: string,
  baseSlug: string,
): BranchKey | null => {
  const snapshot = snapshots.find((entry) => entry.fingerprint === fingerprint);
  if (snapshot !== undefined) {
    return snapshot.key;
  }
  const exact = candidates.find((candidate) => candidate.fingerprint === fingerprint);
  if (exact !== undefined) {
    return exact.key;
  }
  return candidates.find((candidate) => candidate.slug === baseSlug)?.key ?? null;
};

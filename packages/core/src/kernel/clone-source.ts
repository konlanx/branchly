import type { BranchKey } from '../interfaces';

export interface CloneCandidate {
  readonly key: BranchKey;
  readonly slug: string;
  readonly fingerprint: string;
}

export const pickCloneSource = (
  candidates: readonly CloneCandidate[],
  fingerprint: string,
  baseSlug: string,
): BranchKey | null => {
  const exact = candidates.find((candidate) => candidate.fingerprint === fingerprint);
  if (exact !== undefined) {
    return exact.key;
  }
  return candidates.find((candidate) => candidate.slug === baseSlug)?.key ?? null;
};

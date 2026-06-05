import type { ManifestEntry } from '../manifest';

export const selectMerged = (
  entries: readonly ManifestEntry[],
  mergedRefs: readonly string[],
  protect: readonly string[],
  currentRef: string,
): readonly ManifestEntry[] => {
  const merged = new Set(mergedRefs);
  const guarded = new Set(protect);
  return entries.filter((entry) => merged.has(entry.ref) && !guarded.has(entry.ref) && entry.ref !== currentRef);
};

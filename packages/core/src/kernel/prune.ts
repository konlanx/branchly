import type { ManifestEntry } from '../manifest';

export const selectPrunable = (
  entries: readonly ManifestEntry[],
  liveRefs: readonly string[],
  protect: readonly string[],
): readonly ManifestEntry[] => {
  const live = new Set(liveRefs);
  const guarded = new Set(protect);
  return entries.filter((entry) => !live.has(entry.ref) && !guarded.has(entry.ref));
};

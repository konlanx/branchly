import type { BranchKey } from '../interfaces';
import type { Manifest } from '../manifest';
import { makeKey } from './key';
import { resolveSlug } from './slug';

export const slugForRef = (manifest: Manifest, ref: string): string => {
  const claimed = manifest.entries.find((entry) => entry.ref === ref)?.slug;
  if (claimed !== undefined) {
    return claimed;
  }
  return resolveSlug(ref, new Set(manifest.entries.map((entry) => entry.slug)));
};

export const keyForRef = (manifest: Manifest, ref: string, fingerprint: string): BranchKey =>
  makeKey(slugForRef(manifest, ref), fingerprint);

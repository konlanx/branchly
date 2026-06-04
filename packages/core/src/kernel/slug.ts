import { createHash } from 'node:crypto';

const MAX_SLUG_LENGTH = 48;
const COLLISION_HASH_LENGTH = 8;

export const slugify = (ref: string): string =>
  ref
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);

const collisionSuffix = (ref: string): string =>
  `_${createHash('sha256').update(ref).digest('hex').slice(0, COLLISION_HASH_LENGTH)}`;

export const resolveSlug = (ref: string, existingSlugs: ReadonlySet<string>): string => {
  const base = slugify(ref);
  if (!existingSlugs.has(base)) {
    return base;
  }
  const suffix = collisionSuffix(ref);
  return `${base.slice(0, MAX_SLUG_LENGTH - suffix.length).replace(/_+$/, '')}${suffix}`;
};

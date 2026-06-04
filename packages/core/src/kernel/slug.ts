const MAX_SLUG_LENGTH = 48;

export const slugify = (ref: string): string =>
  ref
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SLUG_LENGTH);

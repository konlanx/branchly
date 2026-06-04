import type { BranchKey } from '../interfaces';

const KEY_SEPARATOR = '__';

export const makeKey = (slug: string, fingerprint: string): BranchKey => `${slug}${KEY_SEPARATOR}${fingerprint}`;

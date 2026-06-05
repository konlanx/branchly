import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const resolvedUrl = async (fixture: string): Promise<string> => {
  const content = await readFile(join(fixture, '.env'), 'utf8');
  const line = content.split('\n').find((entry) => entry.startsWith('DATABASE_URL='));
  if (line === undefined) {
    throw new Error('branchly did not write DATABASE_URL to .env');
  }
  return line.slice('DATABASE_URL='.length);
};

export const mainFingerprint = async (fixture: string): Promise<string> => {
  const content = await readFile(join(fixture, '.git', 'branchly', 'manifest.json'), 'utf8');
  const manifest = JSON.parse(content) as { entries: { slug: string; fingerprint: string }[] };
  const entry = manifest.entries.find((item) => item.slug === 'main');
  if (entry === undefined) {
    throw new Error('main entry missing from the manifest');
  }
  return entry.fingerprint;
};

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { BranchKey } from './interfaces';

export const MANIFEST_DIR = '.branchly';
export const MANIFEST_FILE = 'manifest.json';

const MANIFEST_VERSION = 1;

export interface ManifestEntry {
  readonly key: BranchKey;
  readonly slug: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

export interface Manifest {
  readonly version: number;
  readonly entries: readonly ManifestEntry[];
}

export const manifestPath = (root: string): string => join(root, MANIFEST_DIR, MANIFEST_FILE);

export const emptyManifest = (): Manifest => ({ version: MANIFEST_VERSION, entries: [] });

export const recordEntry = (manifest: Manifest, entry: ManifestEntry): Manifest => ({
  ...manifest,
  entries: [...manifest.entries.filter((existing) => existing.key !== entry.key), entry],
});

export const removeEntry = (manifest: Manifest, key: BranchKey): Manifest => ({
  ...manifest,
  entries: manifest.entries.filter((existing) => existing.key !== key),
});

const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && (error as { code?: unknown }).code === 'ENOENT';

export const readManifest = async (path: string): Promise<Manifest> => {
  const content = await readFile(path, 'utf8').catch((error: unknown) => {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  });
  if (content === null) {
    return emptyManifest();
  }
  const parsed = JSON.parse(content) as unknown;
  return parsed as Manifest;
};

export const writeManifest = async (path: string, manifest: Manifest): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

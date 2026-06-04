import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { BranchKey } from './interfaces';

export const MANIFEST_DIR = '.branchly';
export const MANIFEST_FILE = 'manifest.json';

const MANIFEST_VERSION = 1;

export interface ManifestEntry {
  readonly key: BranchKey;
  readonly ref: string;
  readonly slug: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

export interface SnapshotEntry {
  readonly key: BranchKey;
  readonly fingerprint: string;
  readonly createdAt: string;
  readonly clonedAt: string;
}

export interface Manifest {
  readonly version: number;
  readonly entries: readonly ManifestEntry[];
  readonly snapshots: readonly SnapshotEntry[];
}

export const manifestPath = (root: string): string => join(root, MANIFEST_DIR, MANIFEST_FILE);

export const emptyManifest = (): Manifest => ({ version: MANIFEST_VERSION, entries: [], snapshots: [] });

export const recordEntry = (manifest: Manifest, entry: ManifestEntry): Manifest => ({
  ...manifest,
  entries: [...manifest.entries.filter((existing) => existing.key !== entry.key), entry],
});

export const removeEntry = (manifest: Manifest, key: BranchKey): Manifest => ({
  ...manifest,
  entries: manifest.entries.filter((existing) => existing.key !== key),
});

export const recordSnapshot = (manifest: Manifest, snapshot: SnapshotEntry): Manifest => ({
  ...manifest,
  snapshots: [...manifest.snapshots.filter((existing) => existing.fingerprint !== snapshot.fingerprint), snapshot],
});

export const touchSnapshot = (manifest: Manifest, fingerprint: string, clonedAt: string): Manifest => ({
  ...manifest,
  snapshots: manifest.snapshots.map((existing) =>
    existing.fingerprint === fingerprint ? { ...existing, clonedAt } : existing,
  ),
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
  const parsed = JSON.parse(content) as Partial<Manifest>;
  return {
    version: parsed.version ?? MANIFEST_VERSION,
    entries: parsed.entries ?? [],
    snapshots: parsed.snapshots ?? [],
  };
};

export const writeManifest = async (path: string, manifest: Manifest): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
};

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { emptyManifest, manifestPath, readManifest, recordEntry, removeEntry, writeManifest } from './manifest';

const sampleEntry = {
  key: 'main__abc',
  slug: 'main',
  fingerprint: 'abc',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('manifest persistence', () => {
  it('reads an empty manifest when the file is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      expect(await readManifest(manifestPath(root))).toEqual(emptyManifest());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('writes and reads back a recorded entry', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      const path = manifestPath(root);
      await writeManifest(path, recordEntry(emptyManifest(), sampleEntry));
      expect((await readManifest(path)).entries).toEqual([sampleEntry]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('manifest updates', () => {
  it('replaces an entry sharing the same key rather than duplicating', () => {
    const updated = { ...sampleEntry, createdAt: '2026-02-02T00:00:00.000Z' };
    const manifest = recordEntry(recordEntry(emptyManifest(), sampleEntry), updated);
    expect(manifest.entries).toEqual([updated]);
  });

  it('removes an entry by key', () => {
    const manifest = removeEntry(recordEntry(emptyManifest(), sampleEntry), sampleEntry.key);
    expect(manifest.entries).toEqual([]);
  });
});

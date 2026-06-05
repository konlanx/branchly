import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { runSweep } from './sweep';
import { emptyManifest, type ManifestEntry, manifestPath, readManifest, recordEntry, writeManifest } from '../manifest';
import { type AdapterLoader, type Plugins } from '../runtime/plugins';
import { createReporter } from '../runtime/reporter';

const NOW = '2026-06-05T00:00:00.000Z';
const LONG_AGO = '2026-01-01T00:00:00.000Z';

const config = {
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres' },
  resolver: { use: 'env-file' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
};

const entryFor = (ref: string, lastUsedAt: string): ManifestEntry => ({
  key: `${ref}__fp`,
  ref,
  slug: ref,
  fingerprint: 'fp',
  createdAt: lastUsedAt,
  lastUsedAt,
});

const fakePlugins = (destroy: DatasourceAdapter['destroy'], liveRefs: readonly string[]): Plugins => ({
  vcs: {
    id: 'git',
    apiVersion: 1,
    currentRef: () => Promise.resolve('main'),
    liveRefs: () => Promise.resolve([...liveRefs]),
  } satisfies Vcs,
  migrator: {
    id: 'prisma',
    apiVersion: 1,
    fingerprint: () => Promise.resolve('fp'),
    apply: () => Promise.resolve(),
    seed: () => Promise.resolve(),
  } satisfies MigratorAdapter,
  datasource: {
    id: 'postgres',
    apiVersion: 1,
    capabilities: { instantClone: true, snapshot: true, isolatedPerBranch: true },
    resolve: (key) => `conn://${key}`,
    exists: () => Promise.resolve(true),
    list: () => Promise.resolve([]),
    create: () => Promise.resolve(),
    clone: () => Promise.resolve(),
    destroy,
  } satisfies DatasourceAdapter,
  resolver: { id: 'env-file', apiVersion: 1, inject: () => Promise.resolve() } satisfies ConnectionResolver,
});

const loadFrom =
  (plugins: Plugins): AdapterLoader =>
  (name) => {
    if (name.endsWith('vcs-git')) return Promise.resolve(plugins.vcs);
    if (name.endsWith('migrator-prisma')) return Promise.resolve(plugins.migrator);
    if (name.endsWith('datasource-postgres')) return Promise.resolve(plugins.datasource);
    return Promise.resolve(plugins.resolver);
  };

const setup = async (entries: readonly ManifestEntry[], lastSweptAt?: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-sweep-'));
  await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
  const base = entries.reduce(recordEntry, emptyManifest());
  await writeManifest(manifestPath(root), { ...base, lastSweptAt });
  return root;
};

const run = (root: string, destroy: DatasourceAdapter['destroy'], liveRefs: readonly string[]) =>
  runSweep({
    cwd: root,
    reporter: createReporter({ quiet: true }),
    now: () => NOW,
    load: loadFrom(fakePlugins(destroy, liveRefs)),
  });

describe('runSweep', () => {
  it('auto-drops databases for branches that no longer exist locally', async () => {
    const root = await setup([entryFor('main', NOW), entryFor('feature/deleted', NOW)]);
    try {
      const destroy = vi.fn(() => Promise.resolve());
      await run(root, destroy, ['main']);
      expect(destroy).toHaveBeenCalledWith('feature/deleted__fp');
      expect(destroy).toHaveBeenCalledTimes(1);
      const manifest = await readManifest(manifestPath(root));
      expect(manifest.entries.map((entry) => entry.ref)).toEqual(['main']);
      expect(manifest.lastSweptAt).toBe(NOW);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('never drops a stale-but-alive branch — it only nudges', async () => {
    const root = await setup([entryFor('main', NOW), entryFor('feature/stale', LONG_AGO)]);
    try {
      const destroy = vi.fn(() => Promise.resolve());
      await run(root, destroy, ['main', 'feature/stale']);
      expect(destroy).not.toHaveBeenCalled();
      const manifest = await readManifest(manifestPath(root));
      expect(manifest.entries.map((entry) => entry.ref)).toEqual(['main', 'feature/stale']);
      expect(manifest.lastSweptAt).toBe(NOW);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('skips entirely when it has already swept within the interval', async () => {
    const recentlySwept = '2026-06-04T23:00:00.000Z';
    const root = await setup([entryFor('main', NOW), entryFor('feature/deleted', NOW)], recentlySwept);
    try {
      const destroy = vi.fn(() => Promise.resolve());
      await run(root, destroy, ['main']);
      expect(destroy).not.toHaveBeenCalled();
      expect((await readManifest(manifestPath(root))).lastSweptAt).toBe(recentlySwept);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

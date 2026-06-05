import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { emptyManifest, manifestPath, readManifest, recordEntry, writeManifest } from '../manifest';
import { runPrune } from './prune';
import { type AdapterLoader, type Plugins } from '../runtime/plugins';
import { createReporter } from '../runtime/reporter';

const config = {
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres' },
  resolver: { use: 'env-file' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
};

const entryFor = (ref: string, lastUsedAt = 't') => ({
  key: `${ref}__fp`,
  ref,
  slug: ref,
  fingerprint: 'fp',
  createdAt: lastUsedAt,
  lastUsedAt,
});

const fakePlugins = (destroy: DatasourceAdapter['destroy'], liveRefs: readonly string[] = ['main']): Plugins => ({
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

const setup = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-prune-'));
  await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
  const manifest = recordEntry(recordEntry(emptyManifest(), entryFor('main')), entryFor('feature/old'));
  await writeManifest(manifestPath(root), manifest);
  return root;
};

describe('runPrune', () => {
  it('reports prunable databases without dropping them on a dry run', async () => {
    const root = await setup();
    try {
      const destroy = vi.fn(() => Promise.resolve());
      await runPrune({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        force: false,
        load: loadFrom(fakePlugins(destroy)),
      });
      expect(destroy).not.toHaveBeenCalled();
      expect((await readManifest(manifestPath(root))).entries).toHaveLength(2);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('drops dead, unprotected databases and updates the manifest with --force', async () => {
    const root = await setup();
    try {
      const destroy = vi.fn(() => Promise.resolve());
      await runPrune({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        force: true,
        load: loadFrom(fakePlugins(destroy)),
      });
      expect(destroy).toHaveBeenCalledWith('feature/old__fp');
      expect(destroy).toHaveBeenCalledTimes(1);
      const entries = (await readManifest(manifestPath(root))).entries;
      expect(entries.map((entry) => entry.ref)).toEqual(['main']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('also reclaims stale-but-alive branches with --stale --force', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-prune-'));
    try {
      await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
      const manifest = [
        entryFor('main', '2026-06-05T00:00:00.000Z'),
        entryFor('feature/stale', '2026-01-01T00:00:00.000Z'),
        entryFor('feature/fresh', '2026-06-04T00:00:00.000Z'),
      ].reduce(recordEntry, emptyManifest());
      await writeManifest(manifestPath(root), manifest);

      const destroy = vi.fn(() => Promise.resolve());
      await runPrune({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        force: true,
        stale: true,
        now: () => '2026-06-05T00:00:00.000Z',
        load: loadFrom(fakePlugins(destroy, ['main', 'feature/stale', 'feature/fresh'])),
      });

      expect(destroy).toHaveBeenCalledWith('feature/stale__fp');
      expect(destroy).toHaveBeenCalledTimes(1);
      const entries = (await readManifest(manifestPath(root))).entries;
      expect(entries.map((entry) => entry.ref)).toEqual(['main', 'feature/fresh']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('leaves stale-but-alive branches untouched without --stale', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-prune-'));
    try {
      await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
      const manifest = [
        entryFor('main', '2026-06-05T00:00:00.000Z'),
        entryFor('feature/stale', '2026-01-01T00:00:00.000Z'),
      ].reduce(recordEntry, emptyManifest());
      await writeManifest(manifestPath(root), manifest);

      const destroy = vi.fn(() => Promise.resolve());
      await runPrune({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        force: true,
        now: () => '2026-06-05T00:00:00.000Z',
        load: loadFrom(fakePlugins(destroy, ['main', 'feature/stale'])),
      });

      expect(destroy).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { emptyManifest, manifestPath, readManifest, recordEntry, recordSnapshot, writeManifest } from '../manifest';
import { runGc } from './gc';
import { type AdapterLoader, type Plugins } from '../runtime/plugins';
import { createReporter } from '../runtime/reporter';

const config = {
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres' },
  resolver: { use: 'env-file' },
  protect: ['main'],
  cache: { enabled: true, max: 1, base: 'main' },
};

const fakePlugins = (destroy: DatasourceAdapter['destroy']): Plugins => ({
  vcs: { id: 'git', apiVersion: 1, currentRef: () => Promise.resolve('main') } satisfies Vcs,
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

describe('runGc', () => {
  it('evicts cached snapshots beyond cache.max, protecting the base fingerprint', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-gc-'));
    try {
      await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
      const withBase = recordEntry(emptyManifest(), {
        key: 'main__base',
        ref: 'main',
        slug: 'main',
        fingerprint: 'base',
        createdAt: 't',
      });
      const withSnapshots = recordSnapshot(
        recordSnapshot(withBase, { key: '__snapshot__base', fingerprint: 'base', createdAt: 't', clonedAt: 't2' }),
        { key: '__snapshot__old', fingerprint: 'old', createdAt: 't', clonedAt: 't1' },
      );
      await writeManifest(manifestPath(root), withSnapshots);

      const destroy = vi.fn(() => Promise.resolve());
      await runGc({ cwd: root, reporter: createReporter({ quiet: true }), load: loadFrom(fakePlugins(destroy)) });

      expect(destroy).toHaveBeenCalledWith('__snapshot__old');
      expect(destroy).toHaveBeenCalledTimes(1);
      const snapshots = (await readManifest(manifestPath(root))).snapshots;
      expect(snapshots.map((snapshot) => snapshot.fingerprint)).toEqual(['base']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

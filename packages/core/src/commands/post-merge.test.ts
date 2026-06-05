import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { runPostMerge } from './post-merge';
import { emptyManifest, manifestPath, readManifest, recordEntry, writeManifest } from '../manifest';
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

const entryFor = (ref: string) => ({ key: `${ref}__fp`, ref, slug: ref, fingerprint: 'fp', createdAt: 't' });

interface FakePluginConfig {
  readonly destroy: DatasourceAdapter['destroy'];
  readonly mergedRefs?: Vcs['mergedRefs'];
}

const fakePlugins = (fake: FakePluginConfig): Plugins => ({
  vcs: {
    id: 'git',
    apiVersion: 1,
    currentRef: () => Promise.resolve('main'),
    liveRefs: () => Promise.resolve(['main', 'feature/merged', 'feature/active']),
    mergedRefs: fake.mergedRefs,
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
    destroy: fake.destroy,
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
  const root = await mkdtemp(join(tmpdir(), 'branchly-post-merge-'));
  await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
  const manifest = [entryFor('main'), entryFor('feature/merged'), entryFor('feature/active')].reduce(
    recordEntry,
    emptyManifest(),
  );
  await writeManifest(manifestPath(root), manifest);
  return root;
};

const run = (
  root: string,
  destroy: DatasourceAdapter['destroy'],
  confirm: () => Promise<boolean>,
  mergedRefs: Vcs['mergedRefs'],
) =>
  runPostMerge({
    cwd: root,
    reporter: createReporter({ quiet: true }),
    confirm,
    load: loadFrom(fakePlugins({ destroy, mergedRefs })),
  });

describe('runPostMerge', () => {
  it('drops merged, unprotected branch databases when the offer is accepted', async () => {
    const root = await setup();
    try {
      const destroy = vi.fn(() => Promise.resolve());
      const confirm = vi.fn(() => Promise.resolve(true));
      await run(root, destroy, confirm, () => Promise.resolve(['feature/merged']));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(destroy).toHaveBeenCalledWith('feature/merged__fp');
      expect(destroy).toHaveBeenCalledTimes(1);
      const entries = (await readManifest(manifestPath(root))).entries;
      expect(entries.map((entry) => entry.ref)).toEqual(['main', 'feature/active']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps the databases when the offer is declined', async () => {
    const root = await setup();
    try {
      const destroy = vi.fn(() => Promise.resolve());
      const confirm = vi.fn(() => Promise.resolve(false));
      await run(root, destroy, confirm, () => Promise.resolve(['feature/merged']));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(destroy).not.toHaveBeenCalled();
      expect((await readManifest(manifestPath(root))).entries).toHaveLength(3);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not offer anything when no provisioned branch was merged', async () => {
    const root = await setup();
    try {
      const destroy = vi.fn(() => Promise.resolve());
      const confirm = vi.fn(() => Promise.resolve(true));
      await run(root, destroy, confirm, () => Promise.resolve([]));
      expect(confirm).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('silently skips when the VCS adapter cannot report merged branches', async () => {
    const root = await setup();
    try {
      const destroy = vi.fn(() => Promise.resolve());
      const confirm = vi.fn(() => Promise.resolve(true));
      await run(root, destroy, confirm, undefined);
      expect(confirm).not.toHaveBeenCalled();
      expect(destroy).not.toHaveBeenCalled();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

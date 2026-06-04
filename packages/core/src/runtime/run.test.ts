import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { type AdapterLoader, type Plugins } from './plugins';
import { createReporter } from './reporter';
import { provisionCurrent } from './run';

const config = {
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres' },
  resolver: { use: 'env-file' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
};

const fakePlugins = (): Plugins => ({
  vcs: { id: 'git', apiVersion: 1, currentRef: () => Promise.resolve('feature/x') } satisfies Vcs,
  migrator: {
    id: 'prisma',
    apiVersion: 1,
    fingerprint: () => Promise.resolve('fp1'),
    apply: () => Promise.resolve(),
    seed: () => Promise.resolve(),
  } satisfies MigratorAdapter,
  datasource: {
    id: 'postgres',
    apiVersion: 1,
    capabilities: { instantClone: false, snapshot: false, isolatedPerBranch: true },
    resolve: (key) => `conn://${key}`,
    exists: () => Promise.resolve(false),
    list: () => Promise.resolve([]),
    create: () => Promise.resolve(),
    clone: () => Promise.resolve(),
    destroy: () => Promise.resolve(),
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

describe('provisionCurrent', () => {
  it('provisions the current branch and writes the manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-run-'));
    try {
      await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
      const reporter = createReporter({ quiet: true });
      const result = await provisionCurrent({ cwd: root, reporter, now: () => 'ts', load: loadFrom(fakePlugins()) });

      expect(result.outcome).toBe('created');
      expect(result.key).toBe('feature_x__fp1');
      const manifest = JSON.parse(await readFile(join(root, '.branchly', 'manifest.json'), 'utf8')) as {
        entries: unknown[];
      };
      expect(manifest.entries).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

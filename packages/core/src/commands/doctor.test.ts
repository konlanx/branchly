import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { runDoctor } from './doctor';
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

const fakePlugins = (listFails: boolean): Plugins => ({
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
    list: () => (listFails ? Promise.reject(new Error('connection refused')) : Promise.resolve([])),
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

const withConfig = async (action: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-doctor-'));
  try {
    await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
    await action(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

describe('runDoctor', () => {
  it('passes when config, plugins, vcs, and database all check out', async () => {
    await withConfig(async (root) => {
      const ok = await runDoctor({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        load: loadFrom(fakePlugins(false)),
        env: {},
        runCommand: () => Promise.resolve(false),
      });
      expect(ok).toBe(true);
    });
  });

  it('fails when the database is unreachable', async () => {
    await withConfig(async (root) => {
      const ok = await runDoctor({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        load: loadFrom(fakePlugins(true)),
        env: {},
        runCommand: () => Promise.resolve(false),
      });
      expect(ok).toBe(false);
    });
  });

  it('fails when no config is present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-doctor-'));
    try {
      expect(await runDoctor({ cwd: root, reporter: createReporter({ quiet: true }) })).toBe(false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

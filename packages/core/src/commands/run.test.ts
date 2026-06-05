import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { runRun, type Spawner } from './run';
import { type AdapterLoader, type Plugins } from '../runtime/plugins';
import { createReporter } from '../runtime/reporter';

const config = {
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres' },
  resolver: { use: 'env-file', key: 'DATABASE_URL' },
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

describe('runRun', () => {
  it('provisions and launches the command with the per-branch connection injected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-run-'));
    try {
      await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(config)};\n`, 'utf8');
      const captured: { command: string; args: readonly string[]; url: unknown }[] = [];
      const spawner: Spawner = (command, args, env) => {
        captured.push({ command, args, url: env.DATABASE_URL });
        return Promise.resolve(0);
      };

      const code = await runRun({
        cwd: root,
        reporter: createReporter({ quiet: true }),
        command: 'npm',
        args: ['run', 'dev'],
        load: loadFrom(fakePlugins()),
        spawn: spawner,
      });

      expect(code).toBe(0);
      expect(captured).toEqual([{ command: 'npm', args: ['run', 'dev'], url: 'conn://feature_x__fp1' }]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

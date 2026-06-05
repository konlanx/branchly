import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BranchlyConfig } from '../config';
import { env } from '../config';
import { type AdapterLoader, loadPlugins } from './plugins';

const config: BranchlyConfig = {
  vcs: 'git',
  migrator: { use: 'prisma', migrationsDir: 'prisma/migrations' },
  datasource: { use: 'postgres', url: env('DATABASE_URL'), prefix: 'app' },
  resolver: { use: 'env-file', file: '.env' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
};

describe('loadPlugins', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads each axis by convention with env-resolved options', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://here/db');
    const calls: { name: string; options: Record<string, unknown> }[] = [];
    const load: AdapterLoader = (name, options) => {
      calls.push({ name, options });
      return Promise.resolve({ id: name, apiVersion: 1 });
    };

    await loadPlugins(config, { cwd: '/repo', load });

    expect(calls.map((call) => call.name)).toEqual([
      '@branchly/vcs-git',
      '@branchly/migrator-prisma',
      '@branchly/datasource-postgres',
      '@branchly/resolver-env-file',
    ]);
    expect(calls.find((call) => call.name === '@branchly/vcs-git')?.options).toEqual({ cwd: '/repo' });
    expect(calls.find((call) => call.name === '@branchly/datasource-postgres')?.options).toEqual({
      url: 'postgres://here/db',
      prefix: 'app',
      cwd: '/repo',
    });
    expect(calls.find((call) => call.name === '@branchly/migrator-prisma')?.options).toEqual({
      migrationsDir: 'prisma/migrations',
      cwd: '/repo',
    });
  });
});

import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import type { TestProject } from 'vitest/node';

import { run } from './commands';

const WORKSPACE_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const PACKAGES = [
  'core',
  'vcs-git',
  'migrator-prisma',
  'migrator-knex',
  'datasource-postgres',
  'datasource-mysql',
  'resolver-env-file',
];

declare module 'vitest' {
  interface ProvidedContext {
    readonly tarballs: string[];
  }
}

const anySuiteEnabled = (): boolean =>
  [process.env.BRANCHLY_TEST_PG_URL, process.env.BRANCHLY_TEST_MYSQL_URL].some(
    (value) => value !== undefined && value.length > 0,
  );

const packWorkspacePackages = async (): Promise<string[]> => {
  await run('pnpm', ['-r', 'run', 'build'], WORKSPACE_ROOT);
  const directory = await mkdtemp(join(tmpdir(), 'branchly-e2e-packs-'));
  await Promise.all(
    PACKAGES.map((name) =>
      run('pnpm', ['pack', '--pack-destination', directory], join(WORKSPACE_ROOT, 'packages', name)),
    ),
  );
  const entries = await readdir(directory);
  return entries.filter((name) => name.endsWith('.tgz')).map((name) => join(directory, name));
};

export default async (project: TestProject): Promise<void> => {
  project.provide('tarballs', anySuiteEnabled() ? await packWorkspacePackages() : []);
};

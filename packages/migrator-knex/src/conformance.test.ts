import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describeMigratorAdapter } from '@branchly/adapter-test-kit';

import { createKnexMigrator } from './index';

const makeMigrationsDir = async (files: readonly string[]): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-knex-conf-'));
  await mkdir(join(root, 'migrations'), { recursive: true });
  await Promise.all(files.map((name) => writeFile(join(root, 'migrations', name), 'module.exports = {};', 'utf8')));
  return root;
};

const noopRunner = (): Promise<void> => Promise.resolve();

describeMigratorAdapter({
  label: 'knex',
  create: async () => {
    const cwd = await makeMigrationsDir(['20240101_init.js']);
    const altCwd = await makeMigrationsDir(['20240101_init.js', '20240102_users.js']);
    return {
      migrator: createKnexMigrator({ cwd, run: noopRunner }),
      altMigrator: createKnexMigrator({ cwd: altCwd, run: noopRunner }),
      connection: 'postgres://localhost/x',
      cleanup: async () => {
        await rm(cwd, { recursive: true, force: true });
        await rm(altCwd, { recursive: true, force: true });
      },
    };
  },
});

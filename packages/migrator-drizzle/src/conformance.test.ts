import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describeMigratorAdapter } from '@branchly/adapter-test-kit';

import { createDrizzleMigrator } from './index';

const makeMigrationsDir = async (files: readonly string[]): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-drizzle-conf-'));
  await mkdir(join(root, 'drizzle'), { recursive: true });
  await Promise.all(files.map((name) => writeFile(join(root, 'drizzle', name), 'SELECT 1;', 'utf8')));
  return root;
};

const noopRunner = (): Promise<void> => Promise.resolve();

describeMigratorAdapter({
  label: 'drizzle',
  create: async () => {
    const cwd = await makeMigrationsDir(['0000_init.sql']);
    const altCwd = await makeMigrationsDir(['0000_init.sql', '0001_more.sql']);
    return {
      migrator: createDrizzleMigrator({ cwd, run: noopRunner }),
      altMigrator: createDrizzleMigrator({ cwd: altCwd, run: noopRunner }),
      connection: 'postgres://localhost/x',
      cleanup: async () => {
        await rm(cwd, { recursive: true, force: true });
        await rm(altCwd, { recursive: true, force: true });
      },
    };
  },
});

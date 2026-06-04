import { access, copyFile, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { BranchKey, DatasourceAdapter } from 'branchly';

const DEFAULT_DIR = '.branchly/sqlite';
const FILE_SUFFIX = '.sqlite';

export interface SqliteDatasourceOptions {
  readonly cwd?: string;
  readonly dir?: string;
}

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

export const createSqliteDatasource = (options: SqliteDatasourceOptions = {}): DatasourceAdapter => {
  const baseDir = join(options.cwd ?? '.', options.dir ?? DEFAULT_DIR);
  const fileFor = (key: BranchKey): string => join(baseDir, `${key}${FILE_SUFFIX}`);
  return {
    id: 'sqlite',
    apiVersion: 1,
    capabilities: { instantClone: true, snapshot: true, isolatedPerBranch: true },
    resolve: (key) => `file:${fileFor(key)}`,
    exists: (key) => fileExists(fileFor(key)),
    list: async () => {
      const entries = await readdir(baseDir).catch(() => []);
      return entries.filter((name) => name.endsWith(FILE_SUFFIX)).map((name) => name.slice(0, -FILE_SUFFIX.length));
    },
    create: async (key) => {
      await mkdir(baseDir, { recursive: true });
      await writeFile(fileFor(key), '', { flag: 'w' });
    },
    clone: async (from, to) => {
      await mkdir(baseDir, { recursive: true });
      await copyFile(fileFor(from), fileFor(to));
    },
    destroy: async (key) => {
      await rm(fileFor(key), { force: true });
    },
  };
};

export default createSqliteDatasource;

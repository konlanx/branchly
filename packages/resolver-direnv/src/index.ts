import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ConnectionResolver } from 'branchly';

const DEFAULT_FILE = '.envrc';
const DEFAULT_KEY = 'DATABASE_URL';

export interface DirenvResolverOptions {
  readonly file?: string;
  readonly key?: string;
  readonly cwd?: string;
}

export const upsertExport = (content: string, key: string, value: string): string => {
  const line = `export ${key}=${value}`;
  const existing = content.length === 0 ? [] : content.replace(/\n+$/, '').split('\n');
  const replaced = existing.map((current) => (current.startsWith(`export ${key}=`) ? line : current));
  const next = replaced.includes(line) ? replaced : [...replaced, line];
  return `${next.join('\n')}\n`;
};

const readExisting = (path: string): Promise<string> =>
  readFile(path, 'utf8').then(
    (content) => content,
    () => '',
  );

export const createDirenvResolver = (options: DirenvResolverOptions = {}): ConnectionResolver => {
  const path = join(options.cwd ?? '.', options.file ?? DEFAULT_FILE);
  const key = options.key ?? DEFAULT_KEY;
  return {
    id: 'direnv',
    apiVersion: 1,
    inject: async (connection) => {
      const existing = await readExisting(path);
      await writeFile(path, upsertExport(existing, key, connection), 'utf8');
    },
  };
};

export default createDirenvResolver;

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { EnvProvider, EnvProviderContext } from './types';

const ENV_FILE = '.env';

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const definesKey = (content: string, key: string): boolean =>
  new RegExp(`^\\s*(export\\s+)?${escapeForRegExp(key)}\\s*=`, 'm').test(content);

const fileDefinesKey = async (context: EnvProviderContext): Promise<boolean> => {
  const content = await readFile(join(context.cwd, ENV_FILE), 'utf8').catch(() => null);
  return content !== null && definesKey(content, context.key);
};

export const envFileProvider: EnvProvider = {
  id: 'env-file',
  label: 'A .env file',
  hookWrapMarker: '',
  detect: fileDefinesKey,
  wrapHookCommand: (command) => command,
  verifyResolves: fileDefinesKey,
  describe: () => 'loads the value from your .env file (branchly auto-loads .env on every run)',
};

import { access } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG_FILENAMES = ['branchly.config.ts', 'branchly.config.mjs', 'branchly.config.js'];

const fileExists = (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

export const findConfigPath = async (root: string): Promise<string | null> => {
  const checks = await Promise.all(
    CONFIG_FILENAMES.map(async (name) => {
      const path = join(root, name);
      return { path, exists: await fileExists(path) };
    }),
  );
  return checks.find((check) => check.exists)?.path ?? null;
};

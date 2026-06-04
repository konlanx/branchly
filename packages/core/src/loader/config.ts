import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createJiti } from 'jiti';

import type { BranchlyConfig } from '../config';
import { findConfigPath } from './find';
import { validateConfig } from './validate';

const importDefault = async (path: string): Promise<unknown> => {
  const jiti = createJiti(pathToFileURL(path).href);
  return jiti.import(path, { default: true });
};

const readPackageConfig = async (root: string): Promise<unknown> => {
  const content = await readFile(join(root, 'package.json'), 'utf8').then(
    (text) => text,
    () => null,
  );
  if (content === null) {
    return undefined;
  }
  const parsed = JSON.parse(content) as unknown;
  return (parsed as { branchly?: unknown }).branchly;
};

export const loadConfig = async (root: string): Promise<BranchlyConfig> => {
  const configPath = await findConfigPath(root);
  if (configPath !== null) {
    return validateConfig(await importDefault(configPath));
  }
  const packageConfig = await readPackageConfig(root);
  if (packageConfig !== undefined) {
    return validateConfig(packageConfig);
  }
  throw new Error(`No branchly config found in ${root}. Run "branchly init" to create one.`);
};

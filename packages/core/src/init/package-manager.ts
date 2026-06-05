import { access } from 'node:fs/promises';
import { join } from 'node:path';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const LOCKFILES: { readonly file: string; readonly manager: PackageManager }[] = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'package-lock.json', manager: 'npm' },
];

const SUBCOMMAND: Record<PackageManager, string> = { npm: 'install', pnpm: 'add', yarn: 'add', bun: 'add' };
const DEV_FLAG: Record<PackageManager, string> = { npm: '--save-dev', pnpm: '--save-dev', yarn: '--dev', bun: '--dev' };

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

export const detectPackageManager = async (cwd: string): Promise<PackageManager> => {
  const checks = await Promise.all(
    LOCKFILES.map(async (entry) => ({ manager: entry.manager, found: await fileExists(join(cwd, entry.file)) })),
  );
  return checks.find((check) => check.found)?.manager ?? 'npm';
};

export const installArgs = (manager: PackageManager, packages: readonly string[]): string[] => [
  SUBCOMMAND[manager],
  DEV_FLAG[manager],
  ...packages,
];

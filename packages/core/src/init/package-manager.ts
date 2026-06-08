import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const LOCKFILES: { readonly file: string; readonly manager: PackageManager }[] = [
  { file: 'pnpm-lock.yaml', manager: 'pnpm' },
  { file: 'yarn.lock', manager: 'yarn' },
  { file: 'bun.lockb', manager: 'bun' },
  { file: 'package-lock.json', manager: 'npm' },
];

const SUBCOMMAND: Record<PackageManager, string> = { npm: 'install', pnpm: 'add', yarn: 'add', bun: 'add' };
const DEV_FLAG: Record<PackageManager, string> = { npm: '--save-dev', pnpm: '--save-dev', yarn: '--dev', bun: '--dev' };

const HOOK_RUNNER: Record<PackageManager, string> = {
  npm: 'npx branchly',
  pnpm: 'pnpm exec branchly',
  yarn: 'yarn branchly',
  bun: 'bunx branchly',
};

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

const lockfileManager = async (dir: string): Promise<PackageManager | null> => {
  const checks = await Promise.all(
    LOCKFILES.map(async (entry) => ({ manager: entry.manager, found: await fileExists(join(dir, entry.file)) })),
  );
  return checks.find((check) => check.found)?.manager ?? null;
};

const ancestors = (dir: string): string[] => {
  const parent = dirname(dir);
  return parent === dir ? [dir] : [dir, ...ancestors(parent)];
};

const fromUserAgent = (userAgent: string): PackageManager | null => {
  if (userAgent.startsWith('pnpm')) {
    return 'pnpm';
  }
  if (userAgent.startsWith('yarn')) {
    return 'yarn';
  }
  if (userAgent.startsWith('bun')) {
    return 'bun';
  }
  if (userAgent.startsWith('npm')) {
    return 'npm';
  }
  return null;
};

export const detectPackageManager = async (
  cwd: string,
  userAgent: string = process.env.npm_config_user_agent ?? '',
): Promise<PackageManager> => {
  const fromLockfile = await ancestors(cwd).reduce<Promise<PackageManager | null>>(async (previous, dir) => {
    const found = await previous;
    return found ?? (await lockfileManager(dir));
  }, Promise.resolve(null));
  return fromLockfile ?? fromUserAgent(userAgent) ?? 'npm';
};

export const hookRunner = (manager: PackageManager): string => HOOK_RUNNER[manager];

export const installArgs = (manager: PackageManager, packages: readonly string[]): string[] => [
  SUBCOMMAND[manager],
  DEV_FLAG[manager],
  ...packages,
];

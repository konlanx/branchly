import { execFile } from 'node:child_process';
import { access, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const BRANCHLY_HOOK_MARKER = 'branchly on-checkout';

export type HookStatus = 'installed' | 'chained' | 'present';

export interface HookResult {
  readonly status: HookStatus;
  readonly path: string;
  readonly doppler: boolean;
}

export interface InstallHookDeps {
  readonly hooksPath?: string | null;
  readonly doppler?: boolean;
}

export interface HookTarget {
  readonly path: string;
  readonly managed: boolean;
}

export const hookCommand = (useDoppler: boolean): string => {
  const base = 'npx branchly on-checkout "$@"';
  return useDoppler ? `doppler run -- ${base}` : base;
};

export const hookTarget = (repoRoot: string, hooksPath: string | null): HookTarget => {
  if (hooksPath === null || hooksPath.length === 0) {
    return { path: join(repoRoot, '.git', 'hooks', 'post-checkout'), managed: false };
  }
  if (hooksPath.includes('.husky')) {
    return { path: join(repoRoot, '.husky', 'post-checkout'), managed: true };
  }
  const base = isAbsolute(hooksPath) ? hooksPath : join(repoRoot, hooksPath);
  return { path: join(base, 'post-checkout'), managed: false };
};

export const hasBranchlyHook = (content: string): boolean => content.includes(BRANCHLY_HOOK_MARKER);

export const renderHookFile = (command: string, managed: boolean): string => {
  if (managed) {
    return `${command}\n`;
  }
  return `#!/usr/bin/env sh\n[ "$3" = "1" ] || exit 0\nexec ${command}\n`;
};

export const appendHookLine = (existing: string, command: string): string => {
  const base = existing.length === 0 || existing.endsWith('\n') ? existing : `${existing}\n`;
  return `${base}${command}\n`;
};

const readHooksPath = async (cwd: string): Promise<string | null> => {
  const value = await execFileAsync('git', ['config', '--get', 'core.hooksPath'], { cwd }).then(
    ({ stdout }) => stdout.trim(),
    () => '',
  );
  return value.length === 0 ? null : value;
};

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

const detectDoppler = async (cwd: string): Promise<boolean> => {
  const checks = await Promise.all(['doppler.yaml', '.doppler.yaml'].map((name) => fileExists(join(cwd, name))));
  return checks.some((found) => found);
};

const readExisting = (path: string): Promise<string | null> =>
  readFile(path, 'utf8').then(
    (content) => content,
    () => null,
  );

export const installPostCheckoutHook = async (cwd: string, deps: InstallHookDeps = {}): Promise<HookResult> => {
  const hooksPath = 'hooksPath' in deps ? (deps.hooksPath ?? null) : await readHooksPath(cwd);
  const useDoppler = 'doppler' in deps ? deps.doppler === true : await detectDoppler(cwd);
  const command = hookCommand(useDoppler);
  const target = hookTarget(cwd, hooksPath);
  const existing = await readExisting(target.path);

  if (existing !== null && hasBranchlyHook(existing)) {
    return { status: 'present', path: target.path, doppler: useDoppler };
  }
  if (existing !== null) {
    await writeFile(target.path, appendHookLine(existing, command), 'utf8');
    return { status: 'chained', path: target.path, doppler: useDoppler };
  }
  await mkdir(dirname(target.path), { recursive: true });
  await writeFile(target.path, renderHookFile(command, target.managed), 'utf8');
  if (!target.managed) {
    await chmod(target.path, 0o755);
  }
  return { status: 'installed', path: target.path, doppler: useDoppler };
};

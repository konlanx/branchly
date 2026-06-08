import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';

import type { EnvProvider } from './env-providers';
import { shellProvider } from './env-providers/shell';
import { detectPackageManager, hookRunner, type PackageManager } from './package-manager';

const execFileAsync = promisify(execFile);

export type HookWrapper = (command: string) => string;

export interface HookSpec {
  readonly name: string;
  readonly subcommand: string;
  readonly guard?: string;
}

export const POST_CHECKOUT_HOOK: HookSpec = {
  name: 'post-checkout',
  subcommand: 'on-checkout',
  guard: '[ "$3" = "1" ] || exit 0',
};

export const POST_MERGE_HOOK: HookSpec = {
  name: 'post-merge',
  subcommand: 'post-merge',
};

export type HookStatus = 'installed' | 'chained' | 'present';

export interface HookResult {
  readonly status: HookStatus;
  readonly path: string;
  readonly injector: string;
}

export interface InstallHookDeps {
  readonly hooksPath?: string | null;
  readonly injector?: EnvProvider;
  readonly manager?: PackageManager;
}

export interface HookTarget {
  readonly path: string;
  readonly managed: boolean;
}

export const hookMarker = (spec: HookSpec): string => `branchly ${spec.subcommand}`;

export const hookCommand = (spec: HookSpec, wrap: HookWrapper, manager: PackageManager): string =>
  wrap(`${hookRunner(manager)} ${spec.subcommand} "$@"`);

export const hookTarget = (repoRoot: string, hooksPath: string | null, hookName: string): HookTarget => {
  if (hooksPath === null || hooksPath.length === 0) {
    return { path: join(repoRoot, '.git', 'hooks', hookName), managed: false };
  }
  if (hooksPath.includes('.husky')) {
    return { path: join(repoRoot, '.husky', hookName), managed: true };
  }
  const base = isAbsolute(hooksPath) ? hooksPath : join(repoRoot, hooksPath);
  return { path: join(base, hookName), managed: false };
};

export const hasBranchlyHook = (content: string, spec: HookSpec): boolean => content.includes(hookMarker(spec));

export const renderHookFile = (command: string, managed: boolean, guard?: string): string => {
  if (managed) {
    return `${command}\n`;
  }
  const guardLine = guard === undefined ? '' : `${guard}\n`;
  return `#!/usr/bin/env sh\n${guardLine}exec ${command}\n`;
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

const readExisting = (path: string): Promise<string | null> =>
  readFile(path, 'utf8').then(
    (content) => content,
    () => null,
  );

export const installHook = async (cwd: string, spec: HookSpec, deps: InstallHookDeps = {}): Promise<HookResult> => {
  const hooksPath = 'hooksPath' in deps ? (deps.hooksPath ?? null) : await readHooksPath(cwd);
  const injector = deps.injector ?? shellProvider;
  const manager = deps.manager ?? (await detectPackageManager(cwd));
  const command = hookCommand(spec, injector.wrapHookCommand, manager);
  const target = hookTarget(cwd, hooksPath, spec.name);
  const existing = await readExisting(target.path);

  if (existing !== null && hasBranchlyHook(existing, spec)) {
    return { status: 'present', path: target.path, injector: injector.id };
  }
  if (existing !== null) {
    await writeFile(target.path, appendHookLine(existing, command), 'utf8');
    return { status: 'chained', path: target.path, injector: injector.id };
  }
  await mkdir(dirname(target.path), { recursive: true });
  await writeFile(target.path, renderHookFile(command, target.managed, spec.guard), 'utf8');
  if (!target.managed) {
    await chmod(target.path, 0o755);
  }
  return { status: 'installed', path: target.path, injector: injector.id };
};

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import spawn from 'cross-spawn';

import { renderConfig } from '../init/config-template';
import { type DetectedStack, detectStack } from '../init/detect';
import { DATABASE_URL_ENV } from '../init/detect-datasource';
import { ensureIgnored } from '../init/gitignore';
import { type HookResult, installHook, POST_CHECKOUT_HOOK, POST_MERGE_HOOK } from '../init/hook';
import { detectPackageManager, installArgs, type PackageManager } from '../init/package-manager';
import { resolvePluginName } from '../loader/name';
import type { Reporter } from '../runtime/reporter';

const VCS = 'git';

export type Installer = (command: string, args: readonly string[], cwd: string) => Promise<void>;

export interface InitOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly install?: boolean;
  readonly installer?: Installer;
  readonly env?: NodeJS.ProcessEnv;
}

const defaultInstaller: Installer = (command, args, cwd) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args], { cwd, stdio: 'inherit' });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${String(code ?? 0)}`));
      }
    });
  });

const adapterPackages = (detected: DetectedStack): string[] => [
  resolvePluginName('vcs', VCS),
  resolvePluginName('migrator', detected.migrator),
  resolvePluginName('datasource', detected.datasource),
  resolvePluginName('resolver', detected.resolver),
];

const describeHook = (cwd: string, hook: HookResult): string => {
  const where = relative(cwd, hook.path);
  const doppler = hook.doppler ? ' (wrapped with `doppler run`)' : '';
  if (hook.status === 'present') {
    return `already wired up in ${where} 🪝`;
  }
  if (hook.status === 'chained') {
    return `added to your existing ${where}${doppler} 🪝`;
  }
  return `installed at ${where}${doppler} 🪝`;
};

const installHooks = (cwd: string, manager: PackageManager): Promise<readonly [HookResult, HookResult]> =>
  Promise.all([installHook(cwd, POST_CHECKOUT_HOOK, { manager }), installHook(cwd, POST_MERGE_HOOK, { manager })]);

const writeConfigFile = async (cwd: string, content: string): Promise<boolean> => {
  const path = join(cwd, 'branchly.config.ts');
  const present = await readFile(path, 'utf8').then(
    () => true,
    () => false,
  );
  if (present) {
    return false;
  }
  await writeFile(path, content, 'utf8');
  return true;
};

const updateGitignore = async (cwd: string): Promise<void> => {
  const path = join(cwd, '.gitignore');
  const existing = await readFile(path, 'utf8').then(
    (content) => content,
    () => '',
  );
  await writeFile(path, ensureIgnored(existing, ['.env']), 'utf8');
};

const installAdapters = async (
  cwd: string,
  reporter: Reporter,
  manager: PackageManager,
  packages: readonly string[],
  installer: Installer,
): Promise<void> => {
  reporter.step(`installing: ${packages.join(', ')} (with ${manager})`);
  try {
    await installer(manager, installArgs(manager, packages), cwd);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown error';
    reporter.error(
      `install failed (${detail}) — run it yourself: ${manager} ${installArgs(manager, packages).join(' ')}`,
    );
  }
};

export const runInit = async (options: InitOptions): Promise<void> => {
  const { cwd, reporter } = options;
  reporter.intro('branchly init');
  const detected = await detectStack(cwd, options.env);
  reporter.step(`detected:  ${detected.migrator} + ${detected.datasource} + ${detected.resolver}`);

  const packages = adapterPackages(detected);
  const manager = await detectPackageManager(cwd);
  if (options.install ?? true) {
    await installAdapters(cwd, reporter, manager, packages, options.installer ?? defaultInstaller);
  } else {
    reporter.step(`skipped install — run: ${manager} ${installArgs(manager, packages).join(' ')}`);
  }

  const wroteConfig = await writeConfigFile(cwd, renderConfig({ ...detected, databaseUrlEnv: DATABASE_URL_ENV }));
  await updateGitignore(cwd);
  const [checkoutHook, mergeHook] = await installHooks(cwd, manager);
  reporter.step(`config:    ${wroteConfig ? 'wrote branchly.config.ts 📝' : 'kept your existing branchly.config.ts'}`);
  reporter.step('gitignore: .env is covered (branchly keeps its state in .git)');
  reporter.step(`checkout:  ${describeHook(cwd, checkoutHook)}`);
  reporter.step(`merge:     ${describeHook(cwd, mergeHook)}`);
  reporter.step(`next:      nothing! branchly reuses your existing ${DATABASE_URL_ENV} (.env, Doppler, etc.) 🌱`);
  reporter.outro('branchly is set up — happy branching! 🎉');
};

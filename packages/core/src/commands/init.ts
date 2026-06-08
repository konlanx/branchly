import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import process from 'node:process';

import spawn from 'cross-spawn';

import { renderConfig } from '../init/config-template';
import { type DetectedStack, detectStack } from '../init/detect';
import { DATABASE_URL_ENV } from '../init/detect-datasource';
import {
  type CommandRunner,
  detectEnvProviders,
  type EnvProvider,
  type EnvProviderContext,
  spawnSucceeds,
} from '../init/env-providers';
import { ensureIgnored } from '../init/gitignore';
import { type HookResult, installHook, POST_CHECKOUT_HOOK, POST_MERGE_HOOK } from '../init/hook';
import { detectPackageManager, installArgs, type PackageManager } from '../init/package-manager';
import { selectEnvProvider } from '../init/select-env-provider';
import { resolvePluginName } from '../loader/name';
import type { Reporter } from '../runtime/reporter';

const VCS = 'git';

const RESOLVER_FILES: Readonly<Record<string, string>> = { 'env-file': '.env', direnv: '.envrc' };

export type Installer = (command: string, args: readonly string[], cwd: string) => Promise<void>;

export interface InitOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly install?: boolean;
  readonly installer?: Installer;
  readonly env?: NodeJS.ProcessEnv;
  readonly interactive?: boolean;
  readonly envProvider?: string | null;
  readonly runCommand?: CommandRunner;
}

interface ResolverChoice {
  readonly use: string;
  readonly file: string;
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

const resolverFor = (detected: DetectedStack, injector: EnvProvider): ResolverChoice => {
  const use = injector.id === 'direnv' ? 'direnv' : detected.resolver;
  return { use, file: RESOLVER_FILES[use] ?? '.env' };
};

const adapterPackages = (detected: DetectedStack, resolver: ResolverChoice): string[] => [
  resolvePluginName('vcs', VCS),
  resolvePluginName('migrator', detected.migrator),
  resolvePluginName('datasource', detected.datasource),
  resolvePluginName('resolver', resolver.use),
];

const describeHook = (cwd: string, hook: HookResult): string => {
  const where = relative(cwd, hook.path);
  if (hook.status === 'present') {
    return `already wired up in ${where} 🪝`;
  }
  if (hook.status === 'chained') {
    return `added to your existing ${where} 🪝`;
  }
  return `installed at ${where} 🪝`;
};

const installHooks = (
  cwd: string,
  manager: PackageManager,
  injector: EnvProvider,
): Promise<readonly [HookResult, HookResult]> =>
  Promise.all([
    installHook(cwd, POST_CHECKOUT_HOOK, { manager, injector }),
    installHook(cwd, POST_MERGE_HOOK, { manager, injector }),
  ]);

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

const updateGitignore = async (cwd: string, resolverFile: string): Promise<void> => {
  const path = join(cwd, '.gitignore');
  const existing = await readFile(path, 'utf8').then(
    (content) => content,
    () => '',
  );
  await writeFile(path, ensureIgnored(existing, [resolverFile]), 'utf8');
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

const reportVerification = (reporter: Reporter, injector: EnvProvider, resolved: boolean): void => {
  if (resolved) {
    reporter.step(`env:       ${DATABASE_URL_ENV} resolves for your hooks via ${injector.label} ✅`);
    return;
  }
  reporter.error(
    `env: couldn't confirm ${DATABASE_URL_ENV} for your git hooks. branchly ${injector.describe()}. ` +
      `Make sure ${DATABASE_URL_ENV} is available that way, then run \`branchly doctor\` to re-check.`,
  );
};

const pickInjector = (options: InitOptions, detected: readonly EnvProvider[]): Promise<EnvProvider> =>
  selectEnvProvider({
    detected,
    interactive: options.interactive ?? process.stdin.isTTY,
    explicit: options.envProvider,
  });

export const runInit = async (options: InitOptions): Promise<boolean> => {
  const { cwd, reporter } = options;
  reporter.intro('branchly init');
  const env = options.env ?? process.env;
  const runCommand = options.runCommand ?? spawnSucceeds;
  const context: EnvProviderContext = { cwd, env, key: DATABASE_URL_ENV, runCommand };

  const detected = await detectStack(cwd, env);
  const injector = await pickInjector(options, await detectEnvProviders(context));
  const resolver = resolverFor(detected, injector);
  reporter.step(
    `detected:  ${detected.migrator} + ${detected.datasource} + ${resolver.use} (env via ${injector.label})`,
  );

  const packages = adapterPackages(detected, resolver);
  const manager = await detectPackageManager(cwd);
  if (options.install ?? true) {
    await installAdapters(cwd, reporter, manager, packages, options.installer ?? defaultInstaller);
  } else {
    reporter.step(`skipped install — run: ${manager} ${installArgs(manager, packages).join(' ')}`);
  }

  const config = renderConfig({
    ...detected,
    resolver: resolver.use,
    resolverFile: resolver.file,
    databaseUrlEnv: DATABASE_URL_ENV,
  });
  const wroteConfig = await writeConfigFile(cwd, config);
  await updateGitignore(cwd, resolver.file);
  const [checkoutHook, mergeHook] = await installHooks(cwd, manager, injector);
  const resolved = await injector.verifyResolves(context);

  reporter.step(`config:    ${wroteConfig ? 'wrote branchly.config.ts 📝' : 'kept your existing branchly.config.ts'}`);
  reporter.step(`gitignore: ${resolver.file} is covered (branchly keeps its state in .git)`);
  reporter.step(`checkout:  ${describeHook(cwd, checkoutHook)}`);
  reporter.step(`merge:     ${describeHook(cwd, mergeHook)}`);
  reportVerification(reporter, injector, resolved);
  reporter.outro(
    resolved ? 'branchly is set up — happy branching! 🎉' : 'branchly is almost there — see the env note above.',
  );
  return resolved;
};

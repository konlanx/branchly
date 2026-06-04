import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { renderConfig } from '../init/config-template';
import { detectStack } from '../init/detect';
import { ensureIgnored } from '../init/gitignore';
import { installPostCheckoutHook } from '../init/hook';
import { MANIFEST_DIR } from '../manifest';
import type { Reporter } from '../runtime/reporter';

const ADMIN_ENV = 'BRANCHLY_DATABASE_URL';
const APP_ENV = 'DATABASE_URL';

export interface InitOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
}

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
  await writeFile(path, ensureIgnored(existing, [`${MANIFEST_DIR}/`, '.env']), 'utf8');
};

export const runInit = async (options: InitOptions): Promise<void> => {
  const { cwd, reporter } = options;
  reporter.intro('branchly init');
  const detected = await detectStack(cwd);
  const wroteConfig = await writeConfigFile(cwd, renderConfig({ ...detected, adminEnv: ADMIN_ENV, appEnv: APP_ENV }));
  await updateGitignore(cwd);
  const installedHook = await installPostCheckoutHook(cwd);
  reporter.step(`config:    ${wroteConfig ? 'wrote branchly.config.ts 📝' : 'kept your existing branchly.config.ts'}`);
  reporter.step(`detected:  ${detected.migrator} + ${detected.datasource} + ${detected.resolver}`);
  reporter.step(`gitignore: ${MANIFEST_DIR}/ and .env are covered`);
  reporter.step(
    `git hook:  ${installedHook ? 'post-checkout is wired up 🪝' : 'add `npx branchly on-checkout "$@"` to your hook'}`,
  );
  reporter.step(`next:      set ${ADMIN_ENV} to your admin Postgres connection (in .env, Doppler, etc.)`);
  reporter.outro('branchly is set up — happy branching! 🎉');
};

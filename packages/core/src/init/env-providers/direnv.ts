import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { resolveProbe } from './command-runner';
import type { EnvProvider, EnvProviderContext } from './types';

const ENVRC_FILE = '.envrc';

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

const detectDirenv = async (context: EnvProviderContext): Promise<boolean> => {
  const hasEnvrc = await fileExists(join(context.cwd, ENVRC_FILE));
  return hasEnvrc && context.runCommand('direnv', ['version'], context.cwd);
};

export const direnvProvider: EnvProvider = {
  id: 'direnv',
  label: 'direnv (.envrc)',
  hookWrapMarker: 'direnv exec',
  detect: detectDirenv,
  wrapHookCommand: (command) => `direnv exec . ${command}`,
  verifyResolves: (context) =>
    context.runCommand('direnv', ['exec', context.cwd, 'node', '-e', resolveProbe(context.key)], context.cwd),
  describe: () => 'runs hooks under `direnv exec` so your .envrc provides the value',
};

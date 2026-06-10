import { access } from 'node:fs/promises';
import { join } from 'node:path';

import { resolveProbe } from './command-runner';
import type { EnvProvider, EnvProviderContext } from './types';

const CONFIG_FILES = ['doppler.yaml', '.doppler.yaml'];

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

const hasConfigFile = async (cwd: string): Promise<boolean> => {
  const checks = await Promise.all(CONFIG_FILES.map((name) => fileExists(join(cwd, name))));
  return checks.some((found) => found);
};

const hasConfiguredProject = (context: EnvProviderContext): Promise<boolean> =>
  context.runCommand('doppler', ['configure', 'get', 'project', '--plain'], context.cwd);

const detectDoppler = async (context: EnvProviderContext): Promise<boolean> =>
  (await hasConfigFile(context.cwd)) || hasConfiguredProject(context);

export const dopplerProvider: EnvProvider = {
  id: 'doppler',
  label: 'Doppler (doppler CLI)',
  hookWrapMarker: 'doppler run --',
  detect: detectDoppler,
  wrapHookCommand: (command) => `doppler run -- ${command}`,
  verifyResolves: (context) =>
    context.runCommand('doppler', ['run', '--', 'node', '-e', resolveProbe(context.key)], context.cwd),
  describe: () => 'runs hooks under `doppler run` so Doppler injects the value',
};

import type { EnvProvider, EnvProviderContext } from './types';

const isSet = (context: EnvProviderContext): Promise<boolean> =>
  Promise.resolve(context.env[context.key] !== undefined);

export const shellProvider: EnvProvider = {
  id: 'shell',
  label: 'Already exported in my shell',
  hookWrapMarker: '',
  detect: isSet,
  wrapHookCommand: (command) => command,
  verifyResolves: isSet,
  describe: () =>
    'reads the value already exported in your environment (heads up: a fresh shell, CI, or git hook may not have it)',
};

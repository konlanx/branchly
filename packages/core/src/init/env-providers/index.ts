import { direnvProvider } from './direnv';
import { envFileProvider } from './env-file';
import { shellProvider } from './shell';
import type { EnvProvider, EnvProviderContext } from './types';

export const ENV_PROVIDERS: readonly EnvProvider[] = [direnvProvider, envFileProvider, shellProvider];

export const FALLBACK_PROVIDER: EnvProvider = envFileProvider;

export const detectEnvProviders = async (context: EnvProviderContext): Promise<readonly EnvProvider[]> => {
  const flags = await Promise.all(ENV_PROVIDERS.map((provider) => provider.detect(context)));
  return ENV_PROVIDERS.filter((_, index) => flags[index]);
};

export const providerById = (id: string): EnvProvider | null =>
  ENV_PROVIDERS.find((provider) => provider.id === id) ?? null;

export type { CommandRunner, EnvProvider, EnvProviderContext } from './types';
export { spawnSucceeds } from './command-runner';

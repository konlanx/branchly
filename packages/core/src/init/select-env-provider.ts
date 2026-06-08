import { isCancel, select } from '@clack/prompts';

import { ENV_PROVIDERS, type EnvProvider, FALLBACK_PROVIDER, providerById } from './env-providers';

export interface SelectEnvProviderOptions {
  readonly detected: readonly EnvProvider[];
  readonly interactive: boolean;
  readonly explicit?: string | null;
}

const autoChoice = (detected: readonly EnvProvider[]): EnvProvider => detected[0] ?? FALLBACK_PROVIDER;

const optionFor = (provider: EnvProvider, detected: readonly EnvProvider[]) => ({
  value: provider.id,
  label: provider.label,
  hint: detected.includes(provider) ? 'detected' : undefined,
});

const promptForProvider = async (detected: readonly EnvProvider[]): Promise<EnvProvider> => {
  const chosen = await select({
    message: 'How does branchly get your database connection string?',
    options: ENV_PROVIDERS.map((provider) => optionFor(provider, detected)),
    initialValue: autoChoice(detected).id,
  });
  if (isCancel(chosen)) {
    return autoChoice(detected);
  }
  return providerById(chosen) ?? autoChoice(detected);
};

const explicitProvider = (id: string): EnvProvider => {
  const provider = providerById(id);
  if (provider === null) {
    throw new Error(
      `Unknown environment provider "${id}". Pick one of: ${ENV_PROVIDERS.map((each) => each.id).join(', ')}.`,
    );
  }
  return provider;
};

export const selectEnvProvider = (options: SelectEnvProviderOptions): Promise<EnvProvider> => {
  if (options.explicit !== undefined && options.explicit !== null) {
    return Promise.resolve(explicitProvider(options.explicit));
  }
  if (!options.interactive) {
    return Promise.resolve(autoChoice(options.detected));
  }
  return promptForProvider(options.detected);
};

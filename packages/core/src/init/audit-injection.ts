import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { detectEnvProviders, type EnvProvider, type EnvProviderContext } from './env-providers';

const HOOK_LOCATIONS = [join('.git', 'hooks', 'post-checkout'), join('.husky', 'post-checkout')];

export interface InjectionFinding {
  readonly provider: EnvProvider;
  readonly resolves: boolean;
  readonly hookWrapped: boolean;
}

const readHookContent = async (cwd: string): Promise<string> => {
  const contents = await Promise.all(
    HOOK_LOCATIONS.map((location) => readFile(join(cwd, location), 'utf8').catch(() => '')),
  );
  return contents.join('\n');
};

const isExplicit = (provider: EnvProvider): boolean => provider.hookWrapMarker.length > 0;

const findingFor = async (
  provider: EnvProvider,
  context: EnvProviderContext,
  hookContent: string,
): Promise<InjectionFinding> => ({
  provider,
  resolves: await provider.verifyResolves(context),
  hookWrapped: hookContent.includes(provider.hookWrapMarker),
});

export const auditInjection = async (context: EnvProviderContext): Promise<readonly InjectionFinding[]> => {
  const detected = (await detectEnvProviders(context)).filter(isExplicit);
  const hookContent = await readHookContent(context.cwd);
  return Promise.all(detected.map((provider) => findingFor(provider, context, hookContent)));
};

export const unwrappedInjectors = (findings: readonly InjectionFinding[]): readonly InjectionFinding[] =>
  findings.filter((finding) => finding.resolves && !finding.hookWrapped);

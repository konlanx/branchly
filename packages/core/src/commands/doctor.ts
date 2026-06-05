import { loadConfig } from '../loader/config';
import { type AdapterLoader, loadPlugins } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';

export interface DoctorOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly load?: AdapterLoader;
}

const attempt = async <TValue>(action: () => Promise<TValue>): Promise<{ value: TValue } | { error: string }> => {
  try {
    return { value: await action() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'unknown error' };
  }
};

export const runDoctor = async (options: DoctorOptions): Promise<boolean> => {
  const { reporter } = options;
  reporter.intro('branchly doctor');

  const configResult = await attempt(() => loadConfig(options.cwd));
  if ('error' in configResult) {
    reporter.error(`config: ${configResult.error}`);
    reporter.outro('Some checks failed — see above.');
    return false;
  }
  reporter.step('config: branchly.config.ts loaded');

  const pluginsResult = await attempt(() => loadPlugins(configResult.value, { cwd: options.cwd, load: options.load }));
  if ('error' in pluginsResult) {
    reporter.error(`plugins: ${pluginsResult.error}`);
    reporter.outro('Some checks failed — see above.');
    return false;
  }
  reporter.step('plugins: all adapters resolved and loaded');

  const plugins = pluginsResult.value;
  const refResult = await attempt(() => plugins.vcs.currentRef());
  if ('error' in refResult) {
    reporter.error(`vcs: ${refResult.error}`);
  } else {
    reporter.step(`vcs: on branch "${refResult.value}"`);
  }

  const datasourceResult = await attempt(() => plugins.datasource.list());
  if ('error' in datasourceResult) {
    reporter.error(`database: ${datasourceResult.error}`);
  } else {
    reporter.step('database: reachable');
  }

  const ok = !('error' in refResult) && !('error' in datasourceResult);
  reporter.outro(ok ? 'All checks passed — branchly is ready 🩺' : 'Some checks failed — see above.');
  return ok;
};

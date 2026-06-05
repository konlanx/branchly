import { provision, type ProvisionResult } from '../kernel/provision';
import { loadConfig } from '../loader/config';
import { readManifest, writeManifest } from '../manifest';
import { defaultNow } from './now';
import { type AdapterLoader, loadPlugins } from './plugins';
import { narrateEvent, type Reporter } from './reporter';
import { resolveManifestPath } from './state';

export interface ProvisionRunOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly now?: () => string;
  readonly load?: AdapterLoader;
}

export const provisionCurrent = async (options: ProvisionRunOptions): Promise<ProvisionResult> => {
  const config = await loadConfig(options.cwd);
  const plugins = await loadPlugins(config, { cwd: options.cwd, load: options.load });
  const path = await resolveManifestPath(plugins.vcs, options.cwd);
  const manifest = await readManifest(path);
  const result = await provision({
    ...plugins,
    config,
    manifest,
    now: options.now ?? defaultNow,
    report: (event) => {
      narrateEvent(options.reporter, event);
    },
  });
  await writeManifest(path, result.manifest);
  return result;
};

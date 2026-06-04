import { keyForRef } from '../kernel/identity';
import { loadConfig } from '../loader/config';
import { manifestPath, readManifest } from '../manifest';
import { type AdapterLoader, loadPlugins } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';

export interface StatusOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly load?: AdapterLoader;
}

export const runStatus = async (options: StatusOptions): Promise<void> => {
  const config = await loadConfig(options.cwd);
  const plugins = await loadPlugins(config, { cwd: options.cwd, load: options.load });
  const ref = await plugins.vcs.currentRef();
  const fingerprint = await plugins.migrator.fingerprint();
  const manifest = await readManifest(manifestPath(options.cwd));
  const key = keyForRef(manifest, ref, fingerprint);
  const provisioned = await plugins.datasource.exists(key);
  options.reporter.intro('branchly status');
  options.reporter.info(`On branch "${ref}"`);
  options.reporter.info(`database key: ${key}`);
  options.reporter.info(`provisioned:  ${provisioned ? 'yes ✅' : 'no — run `branchly sync` 🚀'}`);
  options.reporter.outro(provisioned ? "you're all set 🌿" : 'run `branchly sync` to provision this branch');
};

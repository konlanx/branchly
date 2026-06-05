import { selectPrunable } from '../kernel/prune';
import { loadConfig } from '../loader/config';
import { type ManifestEntry, manifestPath, readManifest, removeEntry, writeManifest } from '../manifest';
import { type AdapterLoader, loadPlugins } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';

export interface PruneOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly force: boolean;
  readonly load?: AdapterLoader;
}

const describeDryRun = (reporter: Reporter, prunable: readonly ManifestEntry[]): void => {
  prunable.forEach((entry) => {
    reporter.step(`would drop ${entry.key} (branch "${entry.ref}")`);
  });
  reporter.outro(`${String(prunable.length)} database(s) can be pruned — re-run with --force to drop them.`);
};

export const runPrune = async (options: PruneOptions): Promise<void> => {
  const config = await loadConfig(options.cwd);
  const plugins = await loadPlugins(config, { cwd: options.cwd, load: options.load });
  const path = manifestPath(options.cwd);
  const manifest = await readManifest(path);
  options.reporter.intro('branchly prune');

  const liveRefs = (await plugins.vcs.liveRefs?.()) ?? null;
  if (liveRefs === null) {
    options.reporter.error('This VCS adapter cannot list local branches, so prune cannot run safely.');
    return;
  }

  const prunable = selectPrunable(manifest.entries, liveRefs, config.protect);
  if (prunable.length === 0) {
    options.reporter.outro('Nothing to prune — every provisioned branch is still alive 🌿');
    return;
  }
  if (!options.force) {
    describeDryRun(options.reporter, prunable);
    return;
  }

  const next = await prunable.reduce(async (previous, entry) => {
    const current = await previous;
    await plugins.datasource.destroy(entry.key);
    options.reporter.step(`dropped ${entry.key} (branch "${entry.ref}")`);
    return removeEntry(current, entry.key);
  }, Promise.resolve(manifest));
  await writeManifest(path, next);
  options.reporter.outro(`Pruned ${String(prunable.length)} database(s) 🧹`);
};

import type { BranchlyConfig } from '../config';
import type { Vcs } from '../interfaces';
import { dropEntries } from './drop';
import { selectPrunable } from '../kernel/prune';
import { resolvePrunePolicy, selectStale } from '../kernel/sweep';
import { loadConfig } from '../loader/config';
import { type ManifestEntry, readManifest, writeManifest } from '../manifest';
import { defaultNow } from '../runtime/now';
import { type AdapterLoader, loadPlugins } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';
import { resolveManifestPath } from '../runtime/state';

export interface PruneOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly force: boolean;
  readonly stale?: boolean;
  readonly load?: AdapterLoader;
  readonly now?: () => string;
}

const describeDryRun = (reporter: Reporter, prunable: readonly ManifestEntry[]): void => {
  prunable.forEach((entry) => {
    reporter.step(`would drop ${entry.key} (branch "${entry.ref}")`);
  });
  reporter.outro(`${String(prunable.length)} database(s) can be pruned — re-run with --force to drop them.`);
};

interface StaleQuery {
  readonly options: PruneOptions;
  readonly config: BranchlyConfig;
  readonly vcs: Vcs;
  readonly entries: readonly ManifestEntry[];
  readonly liveRefs: readonly string[];
}

const selectStaleWhenRequested = async (query: StaleQuery): Promise<readonly ManifestEntry[]> => {
  if (query.options.stale !== true) {
    return [];
  }
  const now = query.options.now ?? defaultNow;
  const currentRef = await query.vcs.currentRef();
  const maxAgeMs = resolvePrunePolicy(query.config.prune).maxAgeMs;
  return selectStale(query.entries, query.liveRefs, query.config.protect, currentRef, now(), maxAgeMs);
};

export const runPrune = async (options: PruneOptions): Promise<void> => {
  const config = await loadConfig(options.cwd);
  const plugins = await loadPlugins(config, { cwd: options.cwd, load: options.load });
  const path = await resolveManifestPath(plugins.vcs, options.cwd);
  const manifest = await readManifest(path);
  options.reporter.intro('branchly prune');

  const liveRefs = (await plugins.vcs.liveRefs?.()) ?? null;
  if (liveRefs === null) {
    options.reporter.error('This VCS adapter cannot list local branches, so prune cannot run safely.');
    return;
  }

  const dead = selectPrunable(manifest.entries, liveRefs, config.protect);
  const stale = await selectStaleWhenRequested({
    options,
    config,
    vcs: plugins.vcs,
    entries: manifest.entries,
    liveRefs,
  });
  const prunable = [...dead, ...stale];
  if (prunable.length === 0) {
    options.reporter.outro('Nothing to prune — every provisioned branch is still alive 🌿');
    return;
  }
  if (!options.force) {
    describeDryRun(options.reporter, prunable);
    return;
  }

  const next = await dropEntries(plugins.datasource, options.reporter, prunable, manifest);
  await writeManifest(path, next);
  options.reporter.outro(`Pruned ${String(prunable.length)} database(s) 🧹`);
};

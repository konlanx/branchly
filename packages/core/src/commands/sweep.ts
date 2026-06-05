import { dropEntries } from './drop';
import { selectPrunable } from '../kernel/prune';
import { type PrunePolicy, resolvePrunePolicy, selectStale, shouldSweep, SWEEP_INTERVAL_MS } from '../kernel/sweep';
import { loadConfig } from '../loader/config';
import { type Manifest, markSwept, readManifest, writeManifest } from '../manifest';
import { defaultNow } from '../runtime/now';
import { type AdapterLoader, loadPlugins, type Plugins } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';
import { resolveManifestPath } from '../runtime/state';

export interface SweepOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly load?: AdapterLoader;
  readonly now?: () => string;
}

interface SweepContext {
  readonly plugins: Plugins;
  readonly reporter: Reporter;
  readonly liveRefs: readonly string[];
  readonly currentRef: string;
  readonly protect: readonly string[];
  readonly policy: PrunePolicy;
  readonly now: string;
}

const dropDeadBranches = async (context: SweepContext, manifest: Manifest): Promise<Manifest> => {
  const dead = selectPrunable(manifest.entries, context.liveRefs, context.protect);
  if (dead.length === 0) {
    return manifest;
  }
  context.reporter.info(`Tidying up ${String(dead.length)} database(s) for branches you've deleted 🧹`);
  return dropEntries(context.plugins.datasource, context.reporter, dead, manifest);
};

const nudgeStaleBranches = (context: SweepContext, manifest: Manifest): void => {
  const stale = selectStale(
    manifest.entries,
    context.liveRefs,
    context.protect,
    context.currentRef,
    context.now,
    context.policy.maxAgeMs,
  );
  if (stale.length === 0) {
    return;
  }
  context.reporter.info(
    `${String(stale.length)} branch database(s) haven't been visited in a while — run \`branchly prune --stale\` to reclaim them 🌿`,
  );
};

const sweep = async (context: SweepContext, manifest: Manifest): Promise<Manifest> => {
  const dropped = context.policy.autoDropDeleted ? await dropDeadBranches(context, manifest) : manifest;
  if (context.policy.nudge) {
    nudgeStaleBranches(context, dropped);
  }
  return dropped;
};

export const runSweep = async (options: SweepOptions): Promise<void> => {
  const config = await loadConfig(options.cwd);
  const plugins = await loadPlugins(config, { cwd: options.cwd, load: options.load });
  const path = await resolveManifestPath(plugins.vcs, options.cwd);
  const manifest = await readManifest(path);
  const now = options.now ?? defaultNow;
  if (!shouldSweep(manifest.lastSweptAt, now(), SWEEP_INTERVAL_MS)) {
    return;
  }

  const liveRefs = await plugins.vcs.liveRefs?.();
  if (liveRefs === undefined) {
    return;
  }
  const currentRef = await plugins.vcs.currentRef();
  const context: SweepContext = {
    plugins,
    reporter: options.reporter,
    liveRefs,
    currentRef,
    protect: config.protect,
    policy: resolvePrunePolicy(config.prune),
    now: now(),
  };
  const swept = await sweep(context, manifest);
  await writeManifest(path, markSwept(swept, now()));
};

import { evictSnapshots } from '../kernel/cache';
import { slugify } from '../kernel/slug';
import { loadConfig } from '../loader/config';
import { manifestPath, readManifest, writeManifest } from '../manifest';
import { type AdapterLoader, loadPlugins } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';

export interface GcOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly load?: AdapterLoader;
}

export const runGc = async (options: GcOptions): Promise<void> => {
  const config = await loadConfig(options.cwd);
  const plugins = await loadPlugins(config, { cwd: options.cwd, load: options.load });
  const path = manifestPath(options.cwd);
  const manifest = await readManifest(path);
  const baseSlug = slugify(config.cache.base);
  const baseFingerprint = manifest.entries.find((entry) => entry.slug === baseSlug)?.fingerprint;
  const eviction = evictSnapshots(manifest.snapshots, config.cache.max, baseFingerprint);

  options.reporter.intro('branchly gc');
  if (eviction.evicted.length === 0) {
    options.reporter.outro(
      `Snapshot cache is within budget (${String(manifest.snapshots.length)}/${String(config.cache.max)}) — nothing to evict.`,
    );
    return;
  }

  await eviction.evicted.reduce(async (previous, snapshot) => {
    await previous;
    await plugins.datasource.destroy(snapshot.key);
    options.reporter.step(`evicted snapshot ${snapshot.key}`);
  }, Promise.resolve());
  await writeManifest(path, { ...manifest, snapshots: eviction.kept });
  options.reporter.outro(`Evicted ${String(eviction.evicted.length)} cached snapshot(s) 📸`);
};

import { confirm, isCancel } from '@clack/prompts';

import { dropEntries } from './drop';
import { selectMerged } from '../kernel/merged';
import { loadConfig } from '../loader/config';
import { type Manifest, type ManifestEntry, readManifest, writeManifest } from '../manifest';
import { type AdapterLoader, loadPlugins, type Plugins } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';
import { resolveManifestPath } from '../runtime/state';

export type ConfirmPrompt = (message: string) => Promise<boolean>;

export interface PostMergeOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly load?: AdapterLoader;
  readonly confirm?: ConfirmPrompt;
}

const defaultConfirm: ConfirmPrompt = async (message) => {
  const answer = await confirm({ message });
  return !isCancel(answer) && answer;
};

const promptMessage = (merged: readonly ManifestEntry[]): string => {
  const branches = merged.map((entry) => `"${entry.ref}"`).join(', ');
  return `${String(merged.length)} merged branch database(s) can be tidied up: ${branches}. Drop them?`;
};

const describeMerged = (reporter: Reporter, merged: readonly ManifestEntry[]): void => {
  merged.forEach((entry) => {
    reporter.step(`${entry.key} (branch "${entry.ref}") was merged in 🎊`);
  });
};

const applyDrop = async (
  options: PostMergeOptions,
  plugins: Plugins,
  path: string,
  manifest: Manifest,
  merged: readonly ManifestEntry[],
): Promise<void> => {
  const next = await dropEntries(plugins.datasource, options.reporter, merged, manifest);
  await writeManifest(path, next);
  options.reporter.outro(`Tidied up ${String(merged.length)} merged branch database(s) 🧹`);
};

const offerToDrop = async (
  options: PostMergeOptions,
  plugins: Plugins,
  path: string,
  manifest: Manifest,
  merged: readonly ManifestEntry[],
): Promise<void> => {
  options.reporter.intro('branchly post-merge');
  describeMerged(options.reporter, merged);
  const approved = await (options.confirm ?? defaultConfirm)(promptMessage(merged));
  if (!approved) {
    options.reporter.outro('No worries — keeping those databases around for now 🌿');
    return;
  }
  await applyDrop(options, plugins, path, manifest, merged);
};

export const runPostMerge = async (options: PostMergeOptions): Promise<void> => {
  const config = await loadConfig(options.cwd);
  const plugins = await loadPlugins(config, { cwd: options.cwd, load: options.load });
  const mergedRefs = await plugins.vcs.mergedRefs?.();
  if (mergedRefs === undefined) {
    return;
  }

  const currentRef = await plugins.vcs.currentRef();
  const path = await resolveManifestPath(plugins.vcs, options.cwd);
  const manifest = await readManifest(path);
  const merged = selectMerged(manifest.entries, mergedRefs, config.protect, currentRef);
  if (merged.length === 0) {
    return;
  }
  await offerToDrop(options, plugins, path, manifest, merged);
};

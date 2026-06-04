import type { BranchlyConfig } from '../config';
import type {
  BranchKey,
  ConnectionResolver,
  ConnectionString,
  DatasourceAdapter,
  MigratorAdapter,
  Vcs,
} from '../interfaces';
import { type Manifest, recordEntry } from '../manifest';
import { pickCloneSource } from './clone-source';
import { makeKey } from './key';
import { resolveSlug, slugify } from './slug';
import { negotiateStrategy } from './strategy';

export type ProvisionOutcome = 'cloned' | 'created' | 'fast-path';

export interface ProvisionContext {
  readonly vcs: Vcs;
  readonly migrator: MigratorAdapter;
  readonly datasource: DatasourceAdapter;
  readonly resolver: ConnectionResolver;
  readonly config: BranchlyConfig;
  readonly manifest: Manifest;
  readonly now: () => string;
}

export interface ProvisionResult {
  readonly key: BranchKey;
  readonly connection: ConnectionString;
  readonly outcome: ProvisionOutcome;
  readonly manifest: Manifest;
}

const slugForRef = (manifest: Manifest, ref: string): string => {
  const claimed = manifest.entries.find((entry) => entry.ref === ref)?.slug;
  if (claimed !== undefined) {
    return claimed;
  }
  return resolveSlug(ref, new Set(manifest.entries.map((entry) => entry.slug)));
};

const tryClone = async (
  datasource: DatasourceAdapter,
  manifest: Manifest,
  key: BranchKey,
  fingerprint: string,
  baseSlug: string,
): Promise<boolean> => {
  const source = pickCloneSource(manifest.entries, fingerprint, baseSlug);
  if (source === null) {
    return false;
  }
  await datasource.clone(source, key);
  return true;
};

export const provision = async (context: ProvisionContext): Promise<ProvisionResult> => {
  const { vcs, migrator, datasource, resolver, config, manifest, now } = context;
  const ref = await vcs.currentRef();
  const slug = slugForRef(manifest, ref);
  const fingerprint = await migrator.fingerprint();
  const key = makeKey(slug, fingerprint);

  if (await datasource.exists(key)) {
    const connection = datasource.resolve(key);
    await resolver.inject(connection);
    return { key, connection, outcome: 'fast-path', manifest };
  }

  const strategy = negotiateStrategy(datasource.capabilities);
  const cloned = strategy.clone && (await tryClone(datasource, manifest, key, fingerprint, slugify(config.cache.base)));
  if (!cloned) {
    await datasource.create(key);
  }

  const connection = datasource.resolve(key);
  await migrator.apply(connection);
  if (!cloned) {
    await migrator.seed(connection);
  }
  if (strategy.snapshot && config.cache.enabled) {
    await datasource.snapshot?.(key);
  }

  const recorded = recordEntry(manifest, { key, ref, slug, fingerprint, createdAt: now() });
  await resolver.inject(connection);
  return { key, connection, outcome: cloned ? 'cloned' : 'created', manifest: recorded };
};

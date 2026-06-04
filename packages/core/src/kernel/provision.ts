import type { BranchlyConfig } from '../config';
import type {
  BranchKey,
  ConnectionResolver,
  ConnectionString,
  DatasourceAdapter,
  MigratorAdapter,
  Vcs,
} from '../interfaces';
import { type Manifest, recordEntry, recordSnapshot, touchSnapshot } from '../manifest';
import { evictSnapshots, snapshotKeyFor } from './cache';
import { pickCloneSource } from './clone-source';
import { slugForRef } from './identity';
import { makeKey } from './key';
import { slugify } from './slug';
import { negotiateStrategy } from './strategy';

export type ProvisionOutcome = 'cloned' | 'created' | 'fast-path';

export type ProvisionEvent =
  | { readonly kind: 'applying' }
  | { readonly kind: 'cloning'; readonly from: BranchKey }
  | { readonly kind: 'creating' }
  | { readonly kind: 'seeding' }
  | { readonly kind: 'snapshotting' };

export type ProvisionReporter = (event: ProvisionEvent) => void;

export interface ProvisionContext {
  readonly vcs: Vcs;
  readonly migrator: MigratorAdapter;
  readonly datasource: DatasourceAdapter;
  readonly resolver: ConnectionResolver;
  readonly config: BranchlyConfig;
  readonly manifest: Manifest;
  readonly now: () => string;
  readonly report?: ProvisionReporter;
}

export interface ProvisionResult {
  readonly key: BranchKey;
  readonly ref: string;
  readonly slug: string;
  readonly connection: ConnectionString;
  readonly outcome: ProvisionOutcome;
  readonly manifest: Manifest;
}

interface CacheParams {
  readonly datasource: DatasourceAdapter;
  readonly manifest: Manifest;
  readonly key: BranchKey;
  readonly fingerprint: string;
  readonly baseSlug: string;
  readonly max: number;
  readonly now: () => string;
  readonly report: ProvisionReporter;
}

const cacheSnapshot = async (params: CacheParams): Promise<Manifest> => {
  if (params.manifest.snapshots.some((snapshot) => snapshot.fingerprint === params.fingerprint)) {
    return params.manifest;
  }
  params.report({ kind: 'snapshotting' });
  const snapshotKey = snapshotKeyFor(params.fingerprint);
  await params.datasource.clone(params.key, snapshotKey);
  const recorded = recordSnapshot(params.manifest, {
    key: snapshotKey,
    fingerprint: params.fingerprint,
    createdAt: params.now(),
    clonedAt: params.now(),
  });
  const baseFingerprint = recorded.entries.find((entry) => entry.slug === params.baseSlug)?.fingerprint;
  const eviction = evictSnapshots(recorded.snapshots, params.max, baseFingerprint);
  await Promise.all(eviction.evicted.map((snapshot) => params.datasource.destroy(snapshot.key)));
  return { ...recorded, snapshots: eviction.kept };
};

export const provision = async (context: ProvisionContext): Promise<ProvisionResult> => {
  const { vcs, migrator, datasource, resolver, config, manifest, now } = context;
  const report = context.report ?? (() => undefined);
  const ref = await vcs.currentRef();
  const slug = slugForRef(manifest, ref);
  const fingerprint = await migrator.fingerprint();
  const key = makeKey(slug, fingerprint);

  if (await datasource.exists(key)) {
    const connection = datasource.resolve(key);
    await resolver.inject(connection);
    return { key, ref, slug, connection, outcome: 'fast-path', manifest };
  }

  const baseSlug = slugify(config.cache.base);
  const strategy = negotiateStrategy(datasource.capabilities);
  const source = strategy.clone ? pickCloneSource(manifest.snapshots, manifest.entries, fingerprint, baseSlug) : null;
  if (source === null) {
    report({ kind: 'creating' });
    await datasource.create(key);
  } else {
    report({ kind: 'cloning', from: source });
    await datasource.clone(source, key);
  }
  const cloned = source !== null;

  const connection = datasource.resolve(key);
  report({ kind: 'applying' });
  await migrator.apply(connection);
  if (!cloned) {
    report({ kind: 'seeding' });
    await migrator.seed(connection);
  }

  const recorded = recordEntry(manifest, { key, ref, slug, fingerprint, createdAt: now() });
  const clonedFromSnapshot = source === snapshotKeyFor(fingerprint);
  const touched = clonedFromSnapshot ? touchSnapshot(recorded, fingerprint, now()) : recorded;
  const cacheable = !cloned && strategy.snapshot && config.cache.enabled;
  const finalManifest = cacheable
    ? await cacheSnapshot({
        datasource,
        manifest: touched,
        key,
        fingerprint,
        baseSlug,
        max: config.cache.max,
        now,
        report,
      })
    : touched;

  await resolver.inject(connection);
  return { key, ref, slug, connection, outcome: cloned ? 'cloned' : 'created', manifest: finalManifest };
};

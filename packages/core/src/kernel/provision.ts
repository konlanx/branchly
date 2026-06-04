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

  const strategy = negotiateStrategy(datasource.capabilities);
  const source = strategy.clone ? pickCloneSource(manifest.entries, fingerprint, slugify(config.cache.base)) : null;
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
  if (strategy.snapshot && config.cache.enabled) {
    report({ kind: 'snapshotting' });
    await datasource.snapshot?.(key);
  }

  const recorded = recordEntry(manifest, { key, ref, slug, fingerprint, createdAt: now() });
  await resolver.inject(connection);
  return { key, ref, slug, connection, outcome: cloned ? 'cloned' : 'created', manifest: recorded };
};

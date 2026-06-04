import { describe, expect, it, vi } from 'vitest';

import type { BranchlyConfig } from '../config';
import type {
  BranchKey,
  Capabilities,
  ConnectionResolver,
  DatasourceAdapter,
  MigratorAdapter,
  Vcs,
} from '../interfaces';
import { emptyManifest, recordEntry, recordSnapshot } from '../manifest';
import { provision } from './provision';

const baseConfig: BranchlyConfig = {
  vcs: 'git',
  migrator: { use: 'fake' },
  datasource: { use: 'fake' },
  resolver: { use: 'fake' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
};

const caps = (instantClone: boolean, snapshot: boolean): Capabilities => ({
  instantClone,
  snapshot,
  isolatedPerBranch: true,
});

const fakeVcs = (ref: string): Vcs => ({ id: 'git', apiVersion: 1, currentRef: () => Promise.resolve(ref) });

const createMigrator = (fingerprint: string) => {
  const apply = vi.fn(() => Promise.resolve());
  const seed = vi.fn(() => Promise.resolve());
  const adapter: MigratorAdapter = {
    id: 'fake',
    apiVersion: 1,
    fingerprint: () => Promise.resolve(fingerprint),
    apply,
    seed,
  };
  return { adapter, apply, seed };
};

const createDatasource = (capabilities: Capabilities, existing: ReadonlySet<BranchKey> = new Set()) => {
  const present = new Set(existing);
  const create = vi.fn((key: BranchKey) => {
    present.add(key);
    return Promise.resolve();
  });
  const clone = vi.fn((_from: BranchKey, to: BranchKey) => {
    present.add(to);
    return Promise.resolve();
  });
  const destroy = vi.fn((key: BranchKey) => {
    present.delete(key);
    return Promise.resolve();
  });
  const adapter: DatasourceAdapter = {
    id: 'fake',
    apiVersion: 1,
    capabilities,
    resolve: (key) => `conn://${key}`,
    exists: (key) => Promise.resolve(present.has(key)),
    list: () => Promise.resolve([...present]),
    create,
    clone,
    destroy,
  };
  return { adapter, create, clone, destroy };
};

const createResolver = (): { adapter: ConnectionResolver; inject: ReturnType<typeof vi.fn> } => {
  const inject = vi.fn(() => Promise.resolve());
  return { adapter: { id: 'fake', apiVersion: 1, inject }, inject };
};

describe('provision', () => {
  it('takes the fast path when the database already exists', async () => {
    const datasource = createDatasource(caps(false, false), new Set(['main__fp1']));
    const migrator = createMigrator('fp1');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('main'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: baseConfig,
      manifest: emptyManifest(),
      now: () => 'now',
    });

    expect(result.outcome).toBe('fast-path');
    expect(result.key).toBe('main__fp1');
    expect(resolver.inject).toHaveBeenCalledWith('conn://main__fp1');
    expect(datasource.create).not.toHaveBeenCalled();
    expect(migrator.apply).not.toHaveBeenCalled();
  });

  it('creates, applies, and seeds a brand-new branch without clone capability', async () => {
    const datasource = createDatasource(caps(false, false));
    const migrator = createMigrator('fp1');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('feature/x'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: baseConfig,
      manifest: emptyManifest(),
      now: () => 'ts',
    });

    expect(result.outcome).toBe('created');
    expect(result.key).toBe('feature_x__fp1');
    expect(datasource.create).toHaveBeenCalledWith('feature_x__fp1');
    expect(migrator.apply).toHaveBeenCalledWith('conn://feature_x__fp1');
    expect(migrator.seed).toHaveBeenCalledWith('conn://feature_x__fp1');
    expect(datasource.clone).not.toHaveBeenCalled();
    expect(result.manifest.entries).toEqual([
      { key: 'feature_x__fp1', ref: 'feature/x', slug: 'feature_x', fingerprint: 'fp1', createdAt: 'ts' },
    ]);
  });

  it('clones from an exact-fingerprint sibling and skips seeding', async () => {
    const manifest = recordEntry(emptyManifest(), {
      key: 'main__fp1',
      ref: 'main',
      slug: 'main',
      fingerprint: 'fp1',
      createdAt: 't0',
    });
    const datasource = createDatasource(caps(true, false), new Set(['main__fp1']));
    const migrator = createMigrator('fp1');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('feature/y'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: baseConfig,
      manifest,
      now: () => 't1',
    });

    expect(result.outcome).toBe('cloned');
    expect(datasource.clone).toHaveBeenCalledWith('main__fp1', 'feature_y__fp1');
    expect(migrator.apply).toHaveBeenCalledWith('conn://feature_y__fp1');
    expect(migrator.seed).not.toHaveBeenCalled();
  });

  it('clones from the configured base when no exact fingerprint matches', async () => {
    const manifest = recordEntry(emptyManifest(), {
      key: 'main__fp1',
      ref: 'main',
      slug: 'main',
      fingerprint: 'fp1',
      createdAt: 't0',
    });
    const datasource = createDatasource(caps(true, false), new Set(['main__fp1']));
    const migrator = createMigrator('fp2');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('feature/z'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: baseConfig,
      manifest,
      now: () => 't1',
    });

    expect(result.outcome).toBe('cloned');
    expect(datasource.clone).toHaveBeenCalledWith('main__fp1', 'feature_z__fp2');
    expect(migrator.seed).not.toHaveBeenCalled();
  });

  it('creates and records a fingerprint-keyed snapshot on a fresh build', async () => {
    const datasource = createDatasource(caps(true, true));
    const migrator = createMigrator('fp1');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('main'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: baseConfig,
      manifest: emptyManifest(),
      now: () => 't',
    });

    expect(result.outcome).toBe('created');
    expect(migrator.seed).toHaveBeenCalled();
    expect(datasource.clone).toHaveBeenCalledWith('main__fp1', '__snapshot__fp1');
    expect(result.manifest.snapshots).toEqual([
      { key: '__snapshot__fp1', fingerprint: 'fp1', createdAt: 't', clonedAt: 't' },
    ]);
  });

  it('clones from a matching snapshot and skips seeding', async () => {
    const manifest = recordSnapshot(emptyManifest(), {
      key: '__snapshot__fp1',
      fingerprint: 'fp1',
      createdAt: 't0',
      clonedAt: 't0',
    });
    const datasource = createDatasource(caps(true, true), new Set(['__snapshot__fp1']));
    const migrator = createMigrator('fp1');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('feature/x'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: baseConfig,
      manifest,
      now: () => 't1',
    });

    expect(result.outcome).toBe('cloned');
    expect(datasource.clone).toHaveBeenCalledWith('__snapshot__fp1', 'feature_x__fp1');
    expect(migrator.seed).not.toHaveBeenCalled();
    expect(result.manifest.snapshots[0]?.clonedAt).toBe('t1');
  });

  it('evicts the least-recently-cloned snapshot beyond cache.max', async () => {
    const manifest = recordSnapshot(emptyManifest(), {
      key: '__snapshot__old',
      fingerprint: 'old',
      createdAt: 't0',
      clonedAt: 't0',
    });
    const datasource = createDatasource(caps(true, true), new Set(['__snapshot__old']));
    const migrator = createMigrator('fp1');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('feature/x'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: { ...baseConfig, cache: { enabled: true, max: 1, base: 'main' } },
      manifest,
      now: () => 't1',
    });

    expect(datasource.destroy).toHaveBeenCalledWith('__snapshot__old');
    expect(result.manifest.snapshots.map((snapshot) => snapshot.fingerprint)).toEqual(['fp1']);
  });

  it('does not snapshot when caching is disabled', async () => {
    const datasource = createDatasource(caps(true, true));
    const migrator = createMigrator('fp1');
    const resolver = createResolver();

    const result = await provision({
      vcs: fakeVcs('main'),
      migrator: migrator.adapter,
      datasource: datasource.adapter,
      resolver: resolver.adapter,
      config: { ...baseConfig, cache: { ...baseConfig.cache, enabled: false } },
      manifest: emptyManifest(),
      now: () => 't',
    });

    expect(datasource.clone).not.toHaveBeenCalled();
    expect(result.manifest.snapshots).toEqual([]);
  });
});

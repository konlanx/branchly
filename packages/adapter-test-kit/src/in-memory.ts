import type { BranchKey, DatasourceAdapter } from 'branchly';

export interface InMemoryDatasourceOptions {
  readonly instantClone?: boolean;
  readonly snapshot?: boolean;
}

export interface InMemoryDatasource extends DatasourceAdapter {
  readonly store: Map<BranchKey, string>;
}

export const createInMemoryDatasource = (options: InMemoryDatasourceOptions = {}): InMemoryDatasource => {
  const store = new Map<BranchKey, string>();
  const instantClone = options.instantClone ?? true;
  return {
    id: 'in-memory',
    apiVersion: 1,
    capabilities: { instantClone, snapshot: options.snapshot ?? false, isolatedPerBranch: true },
    store,
    resolve: (key) => `memory://${key}`,
    exists: (key) => Promise.resolve(store.has(key)),
    list: () => Promise.resolve([...store.keys()]),
    create: (key) => {
      store.set(key, '');
      return Promise.resolve();
    },
    clone: (from, to) => {
      if (!instantClone) {
        return Promise.reject(new Error('in-memory datasource: clone is not supported without instantClone'));
      }
      store.set(to, store.get(from) ?? '');
      return Promise.resolve();
    },
    destroy: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
  };
};

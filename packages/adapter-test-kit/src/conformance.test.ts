import { type DataProbe, describeDatasourceAdapter, describeMigratorAdapter } from './conformance';
import { createInMemoryDatasource } from './in-memory';
import { createTrivialMigrator } from './trivial-migrator';

const keyFromMemoryConnection = (connection: string): string => connection.replace('memory://', '');

describeDatasourceAdapter({
  label: 'in-memory (instant clone)',
  create: () => {
    const datasource = createInMemoryDatasource({ instantClone: true });
    const probe: DataProbe = {
      write: (connection, marker) => {
        datasource.store.set(keyFromMemoryConnection(connection), marker);
        return Promise.resolve();
      },
      read: (connection) => Promise.resolve(datasource.store.get(keyFromMemoryConnection(connection)) ?? null),
    };
    return Promise.resolve({ datasource, probe, cleanup: () => Promise.resolve() });
  },
});

describeDatasourceAdapter({
  label: 'in-memory (no clone)',
  create: () =>
    Promise.resolve({
      datasource: createInMemoryDatasource({ instantClone: false }),
      cleanup: () => Promise.resolve(),
    }),
});

describeMigratorAdapter({
  label: 'trivial',
  create: () =>
    Promise.resolve({
      migrator: createTrivialMigrator({ fingerprint: 'aaaa' }),
      altMigrator: createTrivialMigrator({ fingerprint: 'bbbb' }),
      connection: 'memory://x',
      cleanup: () => Promise.resolve(),
    }),
});

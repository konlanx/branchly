import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type DataProbe, describeDatasourceAdapter } from '@branchly/adapter-test-kit';

import { createSqliteDatasource } from './index';

const pathFromConnection = (connection: string): string => connection.replace(/^file:/, '');

describeDatasourceAdapter({
  label: 'sqlite',
  create: async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'branchly-sqlite-'));
    const datasource = createSqliteDatasource({ cwd });
    const probe: DataProbe = {
      write: (connection, marker) => writeFile(pathFromConnection(connection), marker, 'utf8'),
      read: (connection) =>
        readFile(pathFromConnection(connection), 'utf8').then(
          (content) => content,
          () => null,
        ),
    };
    return { datasource, probe, cleanup: () => rm(cwd, { recursive: true, force: true }) };
  },
});

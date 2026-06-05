import process from 'node:process';

import type { Connection } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';

import { type DataProbe, describeDatasourceAdapter } from '@branchly/adapter-test-kit';

import { createMysqlDatasource } from './index';

const adminUrl = process.env.BRANCHLY_TEST_MYSQL_URL;

const withConnection = async <ResultType>(
  connectionString: string,
  work: (connection: Connection) => Promise<ResultType>,
): Promise<ResultType> => {
  const { createConnection } = await import('mysql2/promise');
  const connection = await createConnection(connectionString);
  try {
    return await work(connection);
  } finally {
    await connection.end();
  }
};

const readMarker = (rows: unknown): string | null => {
  const [first] = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
  const marker = first?.marker;
  return typeof marker === 'string' ? marker : null;
};

const probe: DataProbe = {
  write: (connectionString, marker) =>
    withConnection(connectionString, async (connection) => {
      await connection.query('CREATE TABLE IF NOT EXISTS branchly_probe (marker TEXT)');
      await connection.query('DELETE FROM branchly_probe');
      await connection.query('INSERT INTO branchly_probe (marker) VALUES (?)', [marker]);
    }),
  read: (connectionString) =>
    withConnection(connectionString, async (connection) => {
      const [rows] = await connection.query('SELECT marker FROM branchly_probe LIMIT 1');
      return readMarker(rows);
    }),
};

if (adminUrl === undefined || adminUrl.length === 0) {
  describe.skip('datasource conformance · mysql (set BRANCHLY_TEST_MYSQL_URL to run)', () => {
    it('requires a MySQL server', () => {
      expect(true).toBe(true);
    });
  });
} else {
  const url = adminUrl;
  const uniquePrefix = (): string => `branchly_test_${Math.random().toString(16).slice(2, 10)}`;
  describeDatasourceAdapter({
    label: 'mysql',
    create: () => {
      const datasource = createMysqlDatasource({ url, prefix: uniquePrefix() });
      const cleanup = async (): Promise<void> => {
        const keys = await datasource.list();
        await Promise.all(keys.map((key) => datasource.destroy(key)));
      };
      return Promise.resolve({ datasource, probe, cleanup });
    },
  });
}

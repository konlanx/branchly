import { type Connection, createConnection } from 'mysql2/promise';

import type { AdminDatabase, WidgetProbe } from '../harness/stack';

const withConnection = async <ResultType>(
  url: string,
  work: (connection: Connection) => Promise<ResultType>,
): Promise<ResultType> => {
  const connection = await createConnection(url);
  try {
    return await work(connection);
  } finally {
    await connection.end();
  }
};

const queryRows = (url: string, sql: string, values: readonly unknown[] = []): Promise<Record<string, unknown>[]> =>
  withConnection(url, async (connection) => {
    const [rows] = await connection.query(sql, [...values]);
    return rows as Record<string, unknown>[];
  });

const dropDatabase = async (adminUrl: string, name: string): Promise<void> => {
  await withConnection(adminUrl, async (connection) => {
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
  });
};

const dropSequentially = (adminUrl: string, names: readonly string[]): Promise<void> =>
  names.reduce(async (previous, name) => {
    await previous;
    await dropDatabase(adminUrl, name);
  }, Promise.resolve());

const listDatabases = async (adminUrl: string, prefix: string): Promise<string[]> => {
  const rows = await queryRows(
    adminUrl,
    'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE ?',
    [`${prefix}\\_%`],
  );
  return rows.map((row) => row.SCHEMA_NAME).filter((name): name is string => typeof name === 'string');
};

export const createMysqlAdmin = (adminUrl: string, prefix: string): AdminDatabase => ({
  databaseExists: async (name) =>
    (await queryRows(adminUrl, 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [name]))
      .length > 0,
  dropDatabase: (name) => dropDatabase(adminUrl, name),
  dropTestDatabases: async () => dropSequentially(adminUrl, await listDatabases(adminUrl, prefix)),
});

export const createMysqlWidgetProbe = (table: string): WidgetProbe => ({
  countWidgets: async (connection) => (await queryRows(connection, `SELECT id FROM \`${table}\``)).length,
  hasColorColumn: async (connection) =>
    (
      await queryRows(
        connection,
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'color'",
        [table],
      )
    ).length > 0,
});

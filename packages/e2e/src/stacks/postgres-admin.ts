import pg from 'pg';

import type { AdminDatabase, WidgetProbe } from '../harness/stack';

const withClient = async <ResultType>(
  connectionString: string,
  work: (client: pg.Client) => Promise<ResultType>,
): Promise<ResultType> => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
};

const queryRows = (
  connectionString: string,
  sql: string,
  values: readonly unknown[] = [],
): Promise<Record<string, unknown>[]> =>
  withClient(connectionString, async (client) => {
    const result = await client.query(sql, [...values]);
    return result.rows as Record<string, unknown>[];
  });

const dropDatabase = async (adminUrl: string, name: string): Promise<void> => {
  await withClient(adminUrl, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}"`);
  });
};

const dropSequentially = (adminUrl: string, names: readonly string[]): Promise<void> =>
  names.reduce(async (previous, name) => {
    await previous;
    await dropDatabase(adminUrl, name);
  }, Promise.resolve());

const listDatabases = async (adminUrl: string, prefix: string): Promise<string[]> => {
  const rows = await queryRows(adminUrl, 'SELECT datname FROM pg_database WHERE datname LIKE $1', [`${prefix}\\_%`]);
  return rows.map((row) => row.datname).filter((name): name is string => typeof name === 'string');
};

export const createPostgresAdmin = (adminUrl: string, prefix: string): AdminDatabase => ({
  databaseExists: async (name) =>
    (await queryRows(adminUrl, 'SELECT 1 FROM pg_database WHERE datname = $1', [name])).length > 0,
  dropDatabase: (name) => dropDatabase(adminUrl, name),
  dropTestDatabases: async () => dropSequentially(adminUrl, await listDatabases(adminUrl, prefix)),
});

export const createPostgresWidgetProbe = (table: string): WidgetProbe => ({
  countWidgets: async (connection) => (await queryRows(connection, `SELECT id FROM "${table}"`)).length,
  hasColorColumn: async (connection) =>
    (
      await queryRows(
        connection,
        "SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'color'",
        [table],
      )
    ).length > 0,
});

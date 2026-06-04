import type { BranchKey, DatasourceAdapter } from 'branchly';

const PG_NAME_PATTERN = /^[a-z0-9_]+$/;
const PG_NAME_MAX_LENGTH = 63;
const DEFAULT_PREFIX = 'app';

export interface SqlResult {
  readonly rows: readonly Record<string, unknown>[];
}

export type SqlRunner = (sql: string, params?: readonly unknown[]) => Promise<SqlResult>;

export interface PostgresDatasourceOptions {
  readonly admin: string;
  readonly prefix?: string;
  readonly query?: SqlRunner;
}

const databaseName = (prefix: string, key: BranchKey): string => {
  const name = `${prefix}_${key}`;
  if (!PG_NAME_PATTERN.test(name) || name.length > PG_NAME_MAX_LENGTH) {
    throw new Error(`branchly: branch key "${key}" does not map to a valid Postgres database name ("${name}").`);
  }
  return name;
};

const createDefaultRunner =
  (admin: string): SqlRunner =>
  async (sql, params = []) => {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: admin });
    await client.connect();
    try {
      const result = await client.query(sql, [...params]);
      return { rows: result.rows as Record<string, unknown>[] };
    } finally {
      await client.end();
    }
  };

export const createPostgresDatasource = (options: PostgresDatasourceOptions): DatasourceAdapter => {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const query = options.query ?? createDefaultRunner(options.admin);
  const nameOf = (key: BranchKey): string => databaseName(prefix, key);
  return {
    id: 'postgres',
    apiVersion: 1,
    capabilities: { instantClone: true, snapshot: true, isolatedPerBranch: true },
    resolve: (key) => {
      const url = new URL(options.admin);
      url.pathname = `/${nameOf(key)}`;
      return url.toString();
    },
    exists: async (key) => {
      const result = await query('SELECT 1 FROM pg_database WHERE datname = $1', [nameOf(key)]);
      return result.rows.length > 0;
    },
    list: async () => {
      const result = await query('SELECT datname FROM pg_database WHERE datname LIKE $1', [`${prefix}_%`]);
      return result.rows
        .map((row) => row.datname)
        .filter((name): name is string => typeof name === 'string')
        .map((name) => name.slice(prefix.length + 1));
    },
    create: async (key) => {
      await query(`CREATE DATABASE "${nameOf(key)}"`);
    },
    clone: async (from, to) => {
      await query(`CREATE DATABASE "${nameOf(to)}" TEMPLATE "${nameOf(from)}"`);
    },
    destroy: async (key) => {
      await query(`DROP DATABASE IF EXISTS "${nameOf(key)}"`);
    },
  };
};

export default createPostgresDatasource;

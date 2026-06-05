import type { Connection } from 'mysql2/promise';

export interface SqlResult {
  readonly rows: readonly Record<string, unknown>[];
}

export type SqlRunner = (sql: string, params?: readonly unknown[]) => Promise<SqlResult>;

export type SqlSessionRunner = <ResultType>(work: (query: SqlRunner) => Promise<ResultType>) => Promise<ResultType>;

const toRows = (result: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(result) ? (result as Record<string, unknown>[]) : [];

const createConnectionRunner =
  (connection: Connection): SqlRunner =>
  async (sql, params = []) => {
    const [result] = await connection.query(sql, [...params]);
    return { rows: toRows(result) };
  };

export const createDefaultSessionRunner =
  (adminConnection: string): SqlSessionRunner =>
  async (work) => {
    const { createConnection } = await import('mysql2/promise');
    const connection = await createConnection(adminConnection);
    try {
      return await work(createConnectionRunner(connection));
    } finally {
      await connection.end();
    }
  };

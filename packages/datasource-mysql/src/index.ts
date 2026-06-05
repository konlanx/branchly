import type { BranchKey, DatasourceAdapter } from 'branchly';

import { cloneDatabase } from './clone';
import { databaseName, prefixLikePattern, withDatabase } from './database-name';
import { createDefaultSessionRunner, type SqlSessionRunner } from './session';

const DEFAULT_PREFIX = 'app';

export type { SqlResult, SqlRunner, SqlSessionRunner } from './session';

export interface MysqlDatasourceOptions {
  readonly url: string;
  readonly prefix?: string;
  readonly session?: SqlSessionRunner;
}

export const createMysqlDatasource = (options: MysqlDatasourceOptions): DatasourceAdapter => {
  const prefix = options.prefix ?? DEFAULT_PREFIX;
  const session = options.session ?? createDefaultSessionRunner(withDatabase(options.url, ''));
  const nameOf = (key: BranchKey): string => databaseName(prefix, key);
  return {
    id: 'mysql',
    apiVersion: 1,
    capabilities: { instantClone: true, snapshot: true, isolatedPerBranch: true },
    resolve: (key) => withDatabase(options.url, nameOf(key)),
    exists: async (key) => {
      const result = await session((query) =>
        query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [nameOf(key)]),
      );
      return result.rows.length > 0;
    },
    list: async () => {
      const result = await session((query) =>
        query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME LIKE ?', [
          prefixLikePattern(prefix),
        ]),
      );
      return result.rows
        .map((row) => row.SCHEMA_NAME)
        .filter((schemaName): schemaName is string => typeof schemaName === 'string')
        .map((schemaName) => schemaName.slice(prefix.length + 1));
    },
    create: (key) =>
      session(async (query) => {
        await query(`CREATE DATABASE \`${nameOf(key)}\``);
      }),
    clone: (from, to) => session((query) => cloneDatabase(query, nameOf(from), nameOf(to))),
    destroy: (key) =>
      session(async (query) => {
        await query(`DROP DATABASE IF EXISTS \`${nameOf(key)}\``);
      }),
  };
};

export default createMysqlDatasource;

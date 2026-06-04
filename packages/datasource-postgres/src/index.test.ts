import { describe, expect, it } from 'vitest';

import { createPostgresDatasource, type SqlResult, type SqlRunner } from './index';

const noRows: SqlResult = { rows: [] };
const admin = 'postgres://user:pass@localhost:5432/postgres';

const recordingRunner = (result: SqlResult) => {
  const calls: { sql: string; params: readonly unknown[] }[] = [];
  const query: SqlRunner = (sql, params = []) => {
    calls.push({ sql, params });
    return Promise.resolve(result);
  };
  return { query, calls };
};

describe('createPostgresDatasource', () => {
  it('resolves a key to a connection string with the per-branch database', () => {
    const datasource = createPostgresDatasource({ admin, prefix: 'app' });
    expect(datasource.resolve('main__abc')).toBe('postgres://user:pass@localhost:5432/app_main__abc');
  });

  it('declares instant-clone and isolation capability', () => {
    const datasource = createPostgresDatasource({ admin });
    expect(datasource.capabilities.instantClone).toBe(true);
    expect(datasource.capabilities.isolatedPerBranch).toBe(true);
  });

  it('creates a database with a quoted name', async () => {
    const { query, calls } = recordingRunner(noRows);
    await createPostgresDatasource({ admin, prefix: 'app', query }).create('main__abc');
    expect(calls[0]?.sql).toBe('CREATE DATABASE "app_main__abc"');
  });

  it('clones a database using TEMPLATE', async () => {
    const { query, calls } = recordingRunner(noRows);
    await createPostgresDatasource({ admin, prefix: 'app', query }).clone('a__fp', 'b__fp');
    expect(calls[0]?.sql).toBe('CREATE DATABASE "app_b__fp" TEMPLATE "app_a__fp"');
  });

  it('destroys a database if it exists', async () => {
    const { query, calls } = recordingRunner(noRows);
    await createPostgresDatasource({ admin, prefix: 'app', query }).destroy('main__abc');
    expect(calls[0]?.sql).toBe('DROP DATABASE IF EXISTS "app_main__abc"');
  });

  it('reports existence based on returned rows', async () => {
    const present = recordingRunner({ rows: [{ exists: 1 }] });
    expect(await createPostgresDatasource({ admin, query: present.query }).exists('main__abc')).toBe(true);
    const absent = recordingRunner(noRows);
    expect(await createPostgresDatasource({ admin, query: absent.query }).exists('main__abc')).toBe(false);
  });

  it('lists provisioned keys by stripping the prefix', async () => {
    const { query } = recordingRunner({ rows: [{ datname: 'app_main__abc' }, { datname: 'app_dev__fp' }] });
    expect(await createPostgresDatasource({ admin, prefix: 'app', query }).list()).toEqual(['main__abc', 'dev__fp']);
  });

  it('rejects a key that cannot form a valid database name', () => {
    const datasource = createPostgresDatasource({ admin, prefix: 'app' });
    expect(() => datasource.resolve('x'.repeat(61))).toThrow(/valid Postgres database name/);
  });
});

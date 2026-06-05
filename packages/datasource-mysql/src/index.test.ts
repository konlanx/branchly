import { describe, expect, it } from 'vitest';

import { createMysqlDatasource, type SqlResult, type SqlSessionRunner } from './index';

const noRows: SqlResult = { rows: [] };
const url = 'mysql://user:pass@localhost:3306/myapp';

const recordingSession = (result: SqlResult) => {
  const calls: { sql: string; params: readonly unknown[] }[] = [];
  const session: SqlSessionRunner = (work) =>
    work((sql, params = []) => {
      calls.push({ sql, params });
      return Promise.resolve(result);
    });
  return { session, calls };
};

describe('createMysqlDatasource', () => {
  it('resolves a key to a connection string with the per-branch database', () => {
    const datasource = createMysqlDatasource({ url, prefix: 'app' });
    expect(datasource.resolve('main__abc')).toBe('mysql://user:pass@localhost:3306/app_main__abc');
  });

  it('keeps host and credentials while swapping the database, whatever the base url points at', () => {
    const perBranch = createMysqlDatasource({ url: 'mysql://user:pass@localhost:3306/app_old__fp' });
    expect(perBranch.resolve('new__fp')).toBe('mysql://user:pass@localhost:3306/app_new__fp');
  });

  it('declares instant-clone, snapshot, and isolation capability', () => {
    const datasource = createMysqlDatasource({ url });
    expect(datasource.capabilities.instantClone).toBe(true);
    expect(datasource.capabilities.snapshot).toBe(true);
    expect(datasource.capabilities.isolatedPerBranch).toBe(true);
  });

  it('creates a database with a backtick-quoted name', async () => {
    const { session, calls } = recordingSession(noRows);
    await createMysqlDatasource({ url, prefix: 'app', session }).create('main__abc');
    expect(calls[0]?.sql).toBe('CREATE DATABASE `app_main__abc`');
  });

  it('destroys a database if it exists', async () => {
    const { session, calls } = recordingSession(noRows);
    await createMysqlDatasource({ url, prefix: 'app', session }).destroy('main__abc');
    expect(calls[0]?.sql).toBe('DROP DATABASE IF EXISTS `app_main__abc`');
  });

  it('reports existence based on returned rows', async () => {
    const present = recordingSession({ rows: [{ SCHEMA_NAME: 'app_main__abc' }] });
    expect(await createMysqlDatasource({ url, session: present.session }).exists('main__abc')).toBe(true);
    const absent = recordingSession(noRows);
    expect(await createMysqlDatasource({ url, session: absent.session }).exists('main__abc')).toBe(false);
  });

  it('lists provisioned keys by stripping the prefix', async () => {
    const { session } = recordingSession({ rows: [{ SCHEMA_NAME: 'app_main__abc' }, { SCHEMA_NAME: 'app_dev__fp' }] });
    expect(await createMysqlDatasource({ url, prefix: 'app', session }).list()).toEqual(['main__abc', 'dev__fp']);
  });

  it('lists with a LIKE pattern that escapes wildcard characters in the prefix', async () => {
    const { session, calls } = recordingSession(noRows);
    await createMysqlDatasource({ url, prefix: 'my_app', session }).list();
    expect(calls[0]?.params).toEqual(['my\\_app\\_%']);
  });

  it('rejects a key that cannot form a valid database name', () => {
    const datasource = createMysqlDatasource({ url, prefix: 'app' });
    expect(() => datasource.resolve('x'.repeat(62))).toThrow(/valid MySQL database name/);
  });
});

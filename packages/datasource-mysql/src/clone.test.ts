import { describe, expect, it } from 'vitest';

import { cloneDatabase } from './clone';
import type { SqlResult, SqlRunner } from './session';

const noRows: SqlResult = { rows: [] };
const usersTableDdl = 'CREATE TABLE `users` (\n  `id` int NOT NULL,\n  PRIMARY KEY (`id`)\n)';
const userNamesViewDdl =
  'CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `user_names` AS ' +
  'select `app_a__fp`.`users`.`id` AS `id` from `app_a__fp`.`users`';

const respond = (sql: string, params: readonly unknown[]): SqlResult => {
  if (sql.startsWith('SELECT TABLE_NAME') && params[1] === 'BASE TABLE') {
    return { rows: [{ TABLE_NAME: 'users' }] };
  }
  if (sql.startsWith('SELECT TABLE_NAME')) {
    return { rows: [{ TABLE_NAME: 'user_names' }] };
  }
  if (sql.startsWith('SHOW CREATE TABLE')) {
    return { rows: [{ Table: 'users', 'Create Table': usersTableDdl }] };
  }
  if (sql.startsWith('SHOW CREATE VIEW')) {
    return { rows: [{ View: 'user_names', 'Create View': userNamesViewDdl }] };
  }
  return noRows;
};

const recordingRunner = () => {
  const calls: { sql: string; params: readonly unknown[] }[] = [];
  const query: SqlRunner = (sql, params = []) => {
    calls.push({ sql, params });
    return Promise.resolve(respond(sql, params));
  };
  return { query, calls };
};

describe('cloneDatabase', () => {
  it('creates the target, copies tables with foreign key checks off, and restores the session', async () => {
    const { query, calls } = recordingRunner();
    await cloneDatabase(query, 'app_a__fp', 'app_b__fp');
    const statements = calls.map((call) => call.sql);
    expect(statements[0]).toBe('CREATE DATABASE `app_b__fp`');
    expect(statements[1]).toBe('USE `app_b__fp`');
    expect(statements[2]).toBe('SET FOREIGN_KEY_CHECKS = 0');
    expect(statements).toContain(usersTableDdl);
    expect(statements).toContain('INSERT INTO `app_b__fp`.`users` SELECT * FROM `app_a__fp`.`users`');
    expect(statements.at(-1)).toBe('SET FOREIGN_KEY_CHECKS = 1');
  });

  it('lists source tables and views by schema', async () => {
    const { query, calls } = recordingRunner();
    await cloneDatabase(query, 'app_a__fp', 'app_b__fp');
    const listCalls = calls.filter((call) => call.sql.startsWith('SELECT TABLE_NAME'));
    expect(listCalls.map((call) => call.params)).toEqual([
      ['app_a__fp', 'BASE TABLE'],
      ['app_a__fp', 'VIEW'],
    ]);
  });

  it('copies the table schema before copying its rows', async () => {
    const { query, calls } = recordingRunner();
    await cloneDatabase(query, 'app_a__fp', 'app_b__fp');
    const statements = calls.map((call) => call.sql);
    expect(statements.indexOf(usersTableDdl)).toBeLessThan(
      statements.indexOf('INSERT INTO `app_b__fp`.`users` SELECT * FROM `app_a__fp`.`users`'),
    );
  });

  it('recreates views against the target schema with the definer stripped', async () => {
    const { query, calls } = recordingRunner();
    await cloneDatabase(query, 'app_a__fp', 'app_b__fp');
    const statements = calls.map((call) => call.sql);
    expect(statements).toContain(
      'CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `user_names` AS ' +
        'select `app_b__fp`.`users`.`id` AS `id` from `app_b__fp`.`users`',
    );
  });

  it('fails loudly when the source schema does not return table DDL', async () => {
    const emptyRunner: SqlRunner = (sql) =>
      Promise.resolve(sql.startsWith('SELECT TABLE_NAME') ? { rows: [{ TABLE_NAME: 'users' }] } : noRows);
    await expect(cloneDatabase(emptyRunner, 'app_a__fp', 'app_b__fp')).rejects.toThrow(/did not return/);
  });
});

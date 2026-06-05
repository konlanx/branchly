import { listTables, showCreateStatement } from './schema-objects';
import { sequentially } from './sequentially';
import type { SqlRunner } from './session';
import { cloneViews } from './views';

const copyTable = async (query: SqlRunner, from: string, to: string, table: string): Promise<void> => {
  const statement = await showCreateStatement(query, `SHOW CREATE TABLE \`${from}\`.\`${table}\``, 'Create Table');
  await query(statement);
  await query(`INSERT INTO \`${to}\`.\`${table}\` SELECT * FROM \`${from}\`.\`${table}\``);
};

const copyTables = async (query: SqlRunner, from: string, to: string): Promise<void> => {
  const tables = await listTables(query, from);
  await sequentially(tables, (table) => copyTable(query, from, to, table));
};

export const cloneDatabase = async (query: SqlRunner, from: string, to: string): Promise<void> => {
  await query(`CREATE DATABASE \`${to}\``);
  await query(`USE \`${to}\``);
  await query('SET FOREIGN_KEY_CHECKS = 0');
  await copyTables(query, from, to);
  await cloneViews(query, from, to);
  await query('SET FOREIGN_KEY_CHECKS = 1');
};

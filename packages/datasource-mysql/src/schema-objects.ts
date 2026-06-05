import type { SqlRunner } from './session';

const listSchemaObjects = async (query: SqlRunner, schema: string, objectType: string): Promise<readonly string[]> => {
  const result = await query(
    'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = ? ORDER BY TABLE_NAME',
    [schema, objectType],
  );
  return result.rows
    .map((row) => row.TABLE_NAME)
    .filter((tableName): tableName is string => typeof tableName === 'string');
};

export const listTables = (query: SqlRunner, schema: string): Promise<readonly string[]> =>
  listSchemaObjects(query, schema, 'BASE TABLE');

export const listViews = (query: SqlRunner, schema: string): Promise<readonly string[]> =>
  listSchemaObjects(query, schema, 'VIEW');

export const showCreateStatement = async (query: SqlRunner, showSql: string, column: string): Promise<string> => {
  const result = await query(showSql);
  const statement = result.rows[0]?.[column];
  if (typeof statement !== 'string') {
    throw new Error(`branchly: \`${showSql}\` did not return a "${column}" statement.`);
  }
  return statement;
};

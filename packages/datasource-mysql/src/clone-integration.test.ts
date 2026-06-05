import process from 'node:process';

import type { Connection } from 'mysql2/promise';
import { describe, expect, it } from 'vitest';

import { createMysqlDatasource } from './index';

const adminUrl = process.env.BRANCHLY_TEST_MYSQL_URL ?? '';

const withConnection = async <ResultType>(
  connectionString: string,
  work: (connection: Connection) => Promise<ResultType>,
): Promise<ResultType> => {
  const { createConnection } = await import('mysql2/promise');
  const connection = await createConnection(connectionString);
  try {
    return await work(connection);
  } finally {
    await connection.end();
  }
};

describe.skipIf(adminUrl.length === 0)('mysql clone with foreign keys and views', () => {
  it('copies fk constraints, rows, and a dependent view', async () => {
    const datasource = createMysqlDatasource({ url: adminUrl, prefix: 'branchly_fk' });
    await datasource.create('src__fp');
    await withConnection(datasource.resolve('src__fp'), async (connection) => {
      await connection.query('CREATE TABLE authors (id INT PRIMARY KEY, name TEXT)');
      await connection.query(
        'CREATE TABLE books (id INT PRIMARY KEY, author_id INT, ' +
          'CONSTRAINT fk_author FOREIGN KEY (author_id) REFERENCES authors (id))',
      );
      await connection.query("INSERT INTO authors VALUES (1, 'ada')");
      await connection.query('INSERT INTO books VALUES (10, 1)');
      await connection.query(
        'CREATE VIEW book_authors AS SELECT books.id, authors.name FROM books JOIN authors ON authors.id = books.author_id',
      );
    });
    await datasource.clone('src__fp', 'dst__fp');
    const observed = await withConnection(datasource.resolve('dst__fp'), async (connection) => {
      const [viewRows] = await connection.query('SELECT name FROM book_authors');
      const [constraintRows] = await connection.query(
        'SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE()',
      );
      return { viewRows, constraintRows };
    });
    await datasource.destroy('src__fp');
    await datasource.destroy('dst__fp');
    expect(observed.viewRows).toEqual([{ name: 'ada' }]);
    expect(observed.constraintRows).toEqual([{ CONSTRAINT_NAME: 'fk_author' }]);
  });
});

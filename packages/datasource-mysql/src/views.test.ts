import { describe, expect, it } from 'vitest';

import type { SqlResult, SqlRunner } from './session';
import { cloneViews, retargetViewStatement } from './views';

const noRows: SqlResult = { rows: [] };

describe('retargetViewStatement', () => {
  it('strips the definer clause', () => {
    const statement = 'CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`%` SQL SECURITY DEFINER VIEW `v` AS select 1';
    expect(retargetViewStatement(statement, 'src', 'dst')).toBe(
      'CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `v` AS select 1',
    );
  });

  it('rewrites source-schema qualifiers to the target schema', () => {
    const statement = 'CREATE VIEW `v` AS select `src`.`users`.`id` from `src`.`users`';
    expect(retargetViewStatement(statement, 'src', 'dst')).toBe(
      'CREATE VIEW `v` AS select `dst`.`users`.`id` from `dst`.`users`',
    );
  });

  it('leaves unrelated schema qualifiers untouched', () => {
    const statement = 'CREATE VIEW `v` AS select `other`.`users`.`id` from `other`.`users`';
    expect(retargetViewStatement(statement, 'src', 'dst')).toBe(statement);
  });
});

const viewDdl = (view: string, dependsOn: string): string =>
  `CREATE VIEW \`${view}\` AS select * from \`src\`.\`${dependsOn}\``;

const dependentViewsRunner = () => {
  const created: string[] = [];
  const calls: string[] = [];
  const query: SqlRunner = (sql) => {
    calls.push(sql);
    if (sql.startsWith('SELECT TABLE_NAME')) {
      return Promise.resolve({ rows: [{ TABLE_NAME: 'a_view' }, { TABLE_NAME: 'b_view' }] });
    }
    if (sql.startsWith('SHOW CREATE VIEW `src`.`a_view`')) {
      return Promise.resolve({ rows: [{ 'Create View': viewDdl('a_view', 'b_view') }] });
    }
    if (sql.startsWith('SHOW CREATE VIEW `src`.`b_view`')) {
      return Promise.resolve({ rows: [{ 'Create View': viewDdl('b_view', 'users') }] });
    }
    if (sql.startsWith('CREATE VIEW `a_view`') && !created.includes('b_view')) {
      return Promise.reject(new Error("Table 'dst.b_view' doesn't exist"));
    }
    if (sql.startsWith('CREATE VIEW `a_view`')) {
      created.push('a_view');
      return Promise.resolve(noRows);
    }
    if (sql.startsWith('CREATE VIEW `b_view`')) {
      created.push('b_view');
      return Promise.resolve(noRows);
    }
    return Promise.resolve(noRows);
  };
  return { query, created, calls };
};

describe('cloneViews', () => {
  it('retries views that depend on later views until every view exists', async () => {
    const { query, created } = dependentViewsRunner();
    await cloneViews(query, 'src', 'dst');
    expect(created).toEqual(['b_view', 'a_view']);
  });

  it('surfaces the underlying error when no view can be created', async () => {
    const stuckRunner: SqlRunner = (sql) => {
      if (sql.startsWith('SELECT TABLE_NAME')) {
        return Promise.resolve({ rows: [{ TABLE_NAME: 'a_view' }] });
      }
      if (sql.startsWith('SHOW CREATE VIEW')) {
        return Promise.resolve({ rows: [{ 'Create View': viewDdl('a_view', 'missing') }] });
      }
      return Promise.reject(new Error("Table 'dst.missing' doesn't exist"));
    };
    await expect(cloneViews(stuckRunner, 'src', 'dst')).rejects.toThrow(/doesn't exist/);
  });

  it('does nothing when the source schema has no views', async () => {
    const calls: string[] = [];
    const emptyRunner: SqlRunner = (sql) => {
      calls.push(sql);
      return Promise.resolve(noRows);
    };
    await cloneViews(emptyRunner, 'src', 'dst');
    expect(calls).toHaveLength(1);
  });
});

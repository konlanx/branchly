import { listViews, showCreateStatement } from './schema-objects';
import type { SqlRunner } from './session';

const DEFINER_PATTERN = /DEFINER=`[^`]*`@`[^`]*`\s*/g;

export const retargetViewStatement = (statement: string, from: string, to: string): string =>
  statement.replace(DEFINER_PATTERN, '').replaceAll(`\`${from}\`.`, `\`${to}\`.`);

const createView = async (query: SqlRunner, from: string, to: string, view: string): Promise<void> => {
  const statement = await showCreateStatement(query, `SHOW CREATE VIEW \`${from}\`.\`${view}\``, 'Create View');
  await query(retargetViewStatement(statement, from, to));
};

const attemptViews = (
  query: SqlRunner,
  from: string,
  to: string,
  views: readonly string[],
): Promise<readonly string[]> =>
  views.reduce<Promise<readonly string[]>>(async (previousFailures, view) => {
    const failures = await previousFailures;
    const failed = await createView(query, from, to, view).then(
      () => false,
      () => true,
    );
    return failed ? [...failures, view] : failures;
  }, Promise.resolve([]));

const createViewsUntilStable = async (
  query: SqlRunner,
  from: string,
  to: string,
  remaining: readonly string[],
): Promise<void> => {
  const [nextView] = remaining;
  if (nextView === undefined) {
    return;
  }
  const failures = await attemptViews(query, from, to, remaining);
  if (failures.length < remaining.length) {
    await createViewsUntilStable(query, from, to, failures);
    return;
  }
  await createView(query, from, to, nextView);
  await createViewsUntilStable(query, from, to, failures.slice(1));
};

export const cloneViews = async (query: SqlRunner, from: string, to: string): Promise<void> => {
  const views = await listViews(query, from);
  await createViewsUntilStable(query, from, to, views);
};

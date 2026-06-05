import process from 'node:process';

import { describe, inject, it } from 'vitest';

import { runFullFlowScenario } from './harness/scenario';
import { createPrismaMysqlStack } from './stacks/prisma-mysql';

const adminUrl = process.env.BRANCHLY_TEST_MYSQL_URL;
const suite = adminUrl === undefined || adminUrl.length === 0 ? describe.skip : describe;

suite('branchly end-to-end · prisma + mysql + git', () => {
  it('provisions, clones from snapshots, and fast-paths per-branch databases across checkouts', async () => {
    await runFullFlowScenario(createPrismaMysqlStack(adminUrl ?? ''), inject('tarballs'));
  });
});

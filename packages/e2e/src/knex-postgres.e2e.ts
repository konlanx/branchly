import process from 'node:process';

import { describe, inject, it } from 'vitest';

import { runFullFlowScenario } from './harness/scenario';
import { createKnexPostgresStack } from './stacks/knex-postgres';

const adminUrl = process.env.BRANCHLY_TEST_PG_URL;
const suite = adminUrl === undefined || adminUrl.length === 0 ? describe.skip : describe;

suite('branchly end-to-end · knex + postgres + git', () => {
  it('provisions, clones from snapshots, and fast-paths per-branch databases across checkouts', async () => {
    await runFullFlowScenario(createKnexPostgresStack(adminUrl ?? ''), inject('tarballs'));
  });
});

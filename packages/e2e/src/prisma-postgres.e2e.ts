import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { describe, expect, inject, it } from 'vitest';

import { run } from './harness/commands';
import { runFullFlowScenario } from './harness/scenario';
import { createPrismaPostgresStack } from './stacks/prisma-postgres';

const adminUrl = process.env.BRANCHLY_TEST_PG_URL;
const suite = adminUrl === undefined || adminUrl.length === 0 ? describe.skip : describe;

const WRITE_RUN_ENV = "require('node:fs').writeFileSync('run-env.txt', process.env.DATABASE_URL ?? '')";

const expectRunInjectsConnection = async (fixture: string, mainConnection: string): Promise<void> => {
  await run('npx', ['--no-install', 'branchly', 'run', '--', 'node', '-e', WRITE_RUN_ENV], fixture);
  expect((await readFile(join(fixture, 'run-env.txt'), 'utf8')).trim()).toBe(mainConnection);
};

suite('branchly end-to-end · prisma + postgres + git', () => {
  it('provisions, clones from snapshots, and fast-paths per-branch databases across checkouts', async () => {
    await runFullFlowScenario(createPrismaPostgresStack(adminUrl ?? ''), inject('tarballs'), {
      afterFirstSync: expectRunInjectsConnection,
    });
  });
});

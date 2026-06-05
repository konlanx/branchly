import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect } from 'vitest';

import { git, quietSync, run, verboseSync } from './commands';
import { mainFingerprint, resolvedUrl } from './fixture-state';
import type { E2eStack } from './stack';

export interface ScenarioHooks {
  readonly afterFirstSync?: (fixture: string, mainConnection: string) => Promise<void>;
}

interface ScenarioContext {
  readonly stack: E2eStack;
  readonly fixture: string;
}

const PACKAGE_JSON = '{ "name": "branchly-e2e-fixture", "private": true }\n';

const installProject = async (context: ScenarioContext, tarballs: readonly string[]): Promise<void> => {
  await writeFile(join(context.fixture, 'package.json'), PACKAGE_JSON, 'utf8');
  await run('npm', ['install', '--no-audit', '--no-fund', ...tarballs, ...context.stack.dependencies], context.fixture);
  await context.stack.writeProjectFiles(context.fixture);
  await git(context.fixture, ['init', '-b', 'main']);
  await git(context.fixture, ['add', '-A']);
  await git(context.fixture, ['commit', '-m', 'init']);
};

const provisionMain = async (context: ScenarioContext): Promise<string> => {
  await quietSync(context.fixture);
  const mainConnection = await resolvedUrl(context.fixture);
  expect(await context.stack.countWidgets(mainConnection)).toBe(1);
  expect(await context.stack.hasColorColumn(mainConnection)).toBe(false);
  return mainConnection;
};

const commitColorMigration = async (context: ScenarioContext): Promise<void> => {
  await git(context.fixture, ['checkout', '-b', 'feature/color']);
  await context.stack.addColorMigration(context.fixture);
  await git(context.fixture, ['add', '-A']);
  await git(context.fixture, ['commit', '-m', 'color']);
};

const provisionFeatureBranch = async (context: ScenarioContext, mainConnection: string): Promise<void> => {
  await commitColorMigration(context);
  await quietSync(context.fixture);
  const featureConnection = await resolvedUrl(context.fixture);
  expect(featureConnection).not.toBe(mainConnection);
  expect(await context.stack.hasColorColumn(featureConnection)).toBe(true);
  expect(await context.stack.countWidgets(featureConnection)).toBe(1);
};

const expectFastPathOnMain = async (context: ScenarioContext, mainConnection: string): Promise<void> => {
  await git(context.fixture, ['checkout', 'main']);
  expect(await verboseSync(context.fixture)).toContain('already in sync');
  expect(await context.stack.hasColorColumn(mainConnection)).toBe(false);
};

const expectSnapshotReuse = async (context: ScenarioContext, mainConnection: string): Promise<void> => {
  const fingerprint = await mainFingerprint(context.fixture);
  expect(await context.stack.admin.databaseExists(`${context.stack.prefix}___snapshot__${fingerprint}`)).toBe(true);
  await git(context.fixture, ['checkout', '-b', 'sibling']);
  await context.stack.admin.dropDatabase(`${context.stack.prefix}_main__${fingerprint}`);
  await quietSync(context.fixture);
  const siblingConnection = await resolvedUrl(context.fixture);
  expect(siblingConnection).not.toBe(mainConnection);
  expect(await context.stack.countWidgets(siblingConnection)).toBe(1);
  expect(await context.stack.hasColorColumn(siblingConnection)).toBe(false);
};

const runScenarioSteps = async (context: ScenarioContext, tarballs: readonly string[], hooks: ScenarioHooks) => {
  await installProject(context, tarballs);
  const mainConnection = await provisionMain(context);
  await (hooks.afterFirstSync?.(context.fixture, mainConnection) ?? Promise.resolve());
  await provisionFeatureBranch(context, mainConnection);
  await expectFastPathOnMain(context, mainConnection);
  await expectSnapshotReuse(context, mainConnection);
  await context.stack.admin.dropTestDatabases();
};

export const runFullFlowScenario = async (
  stack: E2eStack,
  tarballs: readonly string[],
  hooks: ScenarioHooks = {},
): Promise<void> => {
  const fixture = await mkdtemp(join(tmpdir(), 'branchly-e2e-'));
  try {
    await runScenarioSteps({ stack, fixture }, tarballs, hooks);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
};

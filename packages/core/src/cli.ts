#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { runDoctor } from './commands/doctor';
import { runGc } from './commands/gc';
import { runInit } from './commands/init';
import { runOnCheckout } from './commands/on-checkout';
import { runPrune } from './commands/prune';
import { runRun } from './commands/run';
import { runStatus } from './commands/status';
import { runSync } from './commands/sync';
import { createReporter, type Reporter } from './runtime/reporter';

const loadProjectEnv = (cwd: string): void => {
  const envPath = join(cwd, '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
};

const dispatchRun = async (rest: readonly string[], cwd: string): Promise<void> => {
  const tokens = rest[0] === '--' ? rest.slice(1) : rest;
  const [command, ...args] = tokens;
  const reporter = createReporter({ quiet: false });
  if (command === undefined) {
    reporter.error('Usage: branchly run -- <command> [args...]');
    process.exitCode = 1;
    return;
  }
  try {
    const code = await runRun({ cwd, reporter, command, args });
    if (code !== 0) {
      process.exitCode = code;
    }
  } catch (error) {
    reporter.error(error instanceof Error ? error.message : 'Failed to run the command.');
    process.exitCode = 1;
  }
};

const dispatch = (
  command: string | undefined,
  args: readonly string[],
  reporter: Reporter,
  cwd: string,
): Promise<void> => {
  if (command === 'init') {
    return runInit({ cwd, reporter });
  }
  if (command === 'sync') {
    return runSync({ cwd, reporter });
  }
  if (command === 'status') {
    return runStatus({ cwd, reporter });
  }
  if (command === 'prune') {
    return runPrune({ cwd, reporter, force: args.includes('--force') });
  }
  if (command === 'gc') {
    return runGc({ cwd, reporter });
  }
  if (command === 'doctor') {
    return runDoctor({ cwd, reporter }).then((ok) => {
      if (!ok) {
        process.exitCode = 1;
      }
    });
  }
  if (command === 'on-checkout') {
    return runOnCheckout({ cwd, reporter, args });
  }
  reporter.error(
    `Unknown command "${command ?? ''}". Try one of: init, sync, status, run, prune, gc, doctor, on-checkout.`,
  );
  process.exitCode = 1;
  return Promise.resolve();
};

const main = async (argv: readonly string[]): Promise<void> => {
  const tokens = argv.slice(2);
  const cwd = process.cwd();
  loadProjectEnv(cwd);
  if (tokens[0] === 'run') {
    await dispatchRun(tokens.slice(1), cwd);
    return;
  }
  const quiet = tokens.includes('--quiet');
  const [command, ...args] = tokens.filter((token) => token !== '--quiet');
  const reporter = createReporter({ quiet });
  try {
    await dispatch(command, args, reporter, cwd);
  } catch (error) {
    reporter.error(error instanceof Error ? error.message : 'Something unexpected went wrong.');
    process.exitCode = 1;
  }
};

void main(process.argv);

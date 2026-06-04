#!/usr/bin/env node
import process from 'node:process';

import { runInit } from './commands/init';
import { runOnCheckout } from './commands/on-checkout';
import { runStatus } from './commands/status';
import { runSync } from './commands/sync';
import { createReporter, type Reporter } from './runtime/reporter';

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
  if (command === 'on-checkout') {
    return runOnCheckout({ cwd, reporter, args });
  }
  reporter.error(`Unknown command "${command ?? ''}". Try one of: init, sync, status, on-checkout.`);
  process.exitCode = 1;
  return Promise.resolve();
};

const main = async (argv: readonly string[]): Promise<void> => {
  const tokens = argv.slice(2);
  const quiet = tokens.includes('--quiet');
  const [command, ...args] = tokens.filter((token) => token !== '--quiet');
  const reporter = createReporter({ quiet });
  try {
    await dispatch(command, args, reporter, process.cwd());
  } catch (error) {
    reporter.error(error instanceof Error ? error.message : 'Something unexpected went wrong.');
    process.exitCode = 1;
  }
};

void main(process.argv);

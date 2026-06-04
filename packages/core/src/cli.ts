#!/usr/bin/env node
import process from 'node:process';

const main = (argv: readonly string[]): void => {
  const command = argv[2];
  if (command === undefined) {
    process.stdout.write('branchly <command>\n');
    return;
  }
  process.stdout.write(`branchly: unknown command "${command}"\n`);
  process.exitCode = 1;
};

main(process.argv);

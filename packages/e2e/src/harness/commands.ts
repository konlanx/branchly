import { execFile } from 'node:child_process';
import process from 'node:process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const fixtureEnv = (): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== 'DATABASE_URL'));

export const run = (command: string, args: readonly string[], cwd: string): Promise<string> =>
  execFileAsync(command, [...args], { cwd, env: fixtureEnv(), maxBuffer: 16 * 1024 * 1024 }).then(
    ({ stdout }) => stdout,
  );

export const git = (cwd: string, args: readonly string[]): Promise<string> =>
  run('git', ['-c', 'user.email=e2e@branchly.test', '-c', 'user.name=branchly-e2e', ...args], cwd);

export const quietSync = (fixture: string): Promise<string> =>
  run('npx', ['--no-install', 'branchly', 'sync', '--quiet'], fixture);

export const verboseSync = (fixture: string): Promise<string> =>
  run('npx', ['--no-install', 'branchly', 'sync'], fixture);

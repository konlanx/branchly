import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Vcs } from 'branchly';

const execFileAsync = promisify(execFile);

export interface GitVcsOptions {
  readonly cwd?: string;
}

const runGit = (cwd: string | undefined, args: readonly string[]): Promise<string> =>
  execFileAsync('git', [...args], { cwd }).then(({ stdout }) => stdout.trim());

const toLines = (output: string): string[] => output.split('\n').filter((line) => line.length > 0);

export const createGitVcs = (options: GitVcsOptions = {}): Vcs => ({
  id: 'git',
  apiVersion: 1,
  currentRef: () => runGit(options.cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
  liveRefs: () => runGit(options.cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']).then(toLines),
});

export default createGitVcs;

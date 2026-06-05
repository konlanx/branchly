import { execFile } from 'node:child_process';
import { isAbsolute, join, resolve } from 'node:path';
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
  stateDir: async () => {
    const commonDir = await runGit(options.cwd, ['rev-parse', '--git-common-dir']);
    const absolute = isAbsolute(commonDir) ? commonDir : resolve(options.cwd ?? '.', commonDir);
    return join(absolute, 'branchly');
  },
});

export default createGitVcs;

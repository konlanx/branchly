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

const currentRef = (cwd: string | undefined): Promise<string> => runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);

const liveRefs = (cwd: string | undefined): Promise<string[]> =>
  runGit(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']).then(toLines);

const mergedRefs = async (cwd: string | undefined): Promise<string[]> => {
  const [current, merged] = await Promise.all([
    currentRef(cwd),
    runGit(cwd, ['for-each-ref', '--merged', 'HEAD', '--format=%(refname:short)', 'refs/heads']).then(toLines),
  ]);
  return merged.filter((ref) => ref !== current);
};

const stateDir = async (cwd: string | undefined): Promise<string> => {
  const commonDir = await runGit(cwd, ['rev-parse', '--git-common-dir']);
  const absolute = isAbsolute(commonDir) ? commonDir : resolve(cwd ?? '.', commonDir);
  return join(absolute, 'branchly');
};

export const createGitVcs = (options: GitVcsOptions = {}): Vcs => ({
  id: 'git',
  apiVersion: 1,
  currentRef: () => currentRef(options.cwd),
  liveRefs: () => liveRefs(options.cwd),
  mergedRefs: () => mergedRefs(options.cwd),
  stateDir: () => stateDir(options.cwd),
});

export default createGitVcs;

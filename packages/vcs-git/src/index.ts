import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Vcs } from 'branchly';

const execFileAsync = promisify(execFile);

export interface GitVcsOptions {
  readonly cwd?: string;
}

export const createGitVcs = (options: GitVcsOptions = {}): Vcs => ({
  id: 'git',
  apiVersion: 1,
  currentRef: async () => {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: options.cwd });
    return stdout.trim();
  },
});

export default createGitVcs;

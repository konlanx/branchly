import { join } from 'node:path';

import type { Vcs } from '../interfaces';
import { MANIFEST_FILE, manifestPath } from '../manifest';

export const resolveManifestPath = async (vcs: Vcs, cwd: string): Promise<string> => {
  const dir = await vcs.stateDir?.();
  return dir === undefined ? manifestPath(cwd) : join(dir, MANIFEST_FILE);
};

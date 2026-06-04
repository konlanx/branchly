import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const POST_CHECKOUT_HOOK = `#!/usr/bin/env sh
[ "$3" = "1" ] || exit 0
exec npx branchly on-checkout "$@"
`;

export const hookPath = (cwd: string): string => join(cwd, '.git', 'hooks', 'post-checkout');

export const installPostCheckoutHook = async (cwd: string): Promise<boolean> => {
  const path = hookPath(cwd);
  const existing = await readFile(path, 'utf8').then(
    (content) => content,
    () => null,
  );
  if (existing !== null) {
    return existing.includes('branchly on-checkout');
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, POST_CHECKOUT_HOOK, 'utf8');
  await chmod(path, 0o755);
  return true;
};

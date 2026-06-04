import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describeResolverAdapter } from '@branchly/adapter-test-kit';

import { createEnvFileResolver } from './index';

const readKey = (content: string, key: string): string | null =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${key}=`))
    .map((line) => line.slice(`${key}=`.length))
    .at(-1) ?? null;

describeResolverAdapter({
  label: 'env-file',
  create: async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'branchly-env-'));
    const resolver = createEnvFileResolver({ cwd, file: '.env', key: 'DATABASE_URL' });
    const observe = (): Promise<string | null> =>
      readFile(join(cwd, '.env'), 'utf8').then(
        (content) => readKey(content, 'DATABASE_URL'),
        () => null,
      );
    return { resolver, observe, cleanup: () => rm(cwd, { recursive: true, force: true }) };
  },
});

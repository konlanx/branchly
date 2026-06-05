import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describeResolverAdapter } from '@branchly/adapter-test-kit';

import { createDirenvResolver } from './index';

const readExport = (content: string, key: string): string | null =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`export ${key}=`))
    .map((line) => line.slice(`export ${key}=`.length))
    .at(-1) ?? null;

describeResolverAdapter({
  label: 'direnv',
  create: async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'branchly-direnv-'));
    const resolver = createDirenvResolver({ cwd, file: '.envrc', key: 'DATABASE_URL' });
    const observe = (): Promise<string | null> =>
      readFile(join(cwd, '.envrc'), 'utf8').then(
        (content) => readExport(content, 'DATABASE_URL'),
        () => null,
      );
    return { resolver, observe, cleanup: () => rm(cwd, { recursive: true, force: true }) };
  },
});

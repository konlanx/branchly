import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { runInit } from './init';
import { createReporter } from '../runtime/reporter';

describe('runInit', () => {
  it('writes a config, updates .gitignore, and installs the hook', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-init-'));
    try {
      await runInit({ cwd: root, reporter: createReporter({ quiet: true }) });
      expect(await readFile(join(root, 'branchly.config.ts'), 'utf8')).toContain('defineConfig');
      expect(await readFile(join(root, '.gitignore'), 'utf8')).toContain('.branchly/');
      expect(await readFile(join(root, '.git', 'hooks', 'post-checkout'), 'utf8')).toContain('branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

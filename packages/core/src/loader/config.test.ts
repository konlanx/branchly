import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadConfig } from './config';

const validConfig = {
  vcs: 'git',
  migrator: { use: 'prisma' },
  datasource: { use: 'postgres', prefix: 'app' },
  resolver: { use: 'env-file', file: '.env', key: 'DATABASE_URL' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
};

describe('loadConfig', () => {
  it('loads and validates a branchly.config.ts file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      await writeFile(join(root, 'branchly.config.ts'), `export default ${JSON.stringify(validConfig)};\n`, 'utf8');
      expect((await loadConfig(root)).vcs).toBe('git');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('falls back to a branchly key in package.json', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      await writeFile(join(root, 'package.json'), JSON.stringify({ name: 'demo', branchly: validConfig }), 'utf8');
      expect((await loadConfig(root)).datasource.use).toBe('postgres');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('throws an actionable error when no config exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      await expect(loadConfig(root)).rejects.toThrow(/branchly init/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

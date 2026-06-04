import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findConfigPath } from './find';

describe('findConfigPath', () => {
  it('returns null when no config file exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      expect(await findConfigPath(root)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('finds a branchly.config.ts file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      const path = join(root, 'branchly.config.ts');
      await writeFile(path, 'export default {};\n', 'utf8');
      expect(await findConfigPath(root)).toBe(path);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('prefers .ts over .js when both exist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-'));
    try {
      await writeFile(join(root, 'branchly.config.js'), 'module.exports = {};\n', 'utf8');
      const tsPath = join(root, 'branchly.config.ts');
      await writeFile(tsPath, 'export default {};\n', 'utf8');
      expect(await findConfigPath(root)).toBe(tsPath);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

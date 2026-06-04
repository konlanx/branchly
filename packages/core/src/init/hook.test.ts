import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { hookPath, installPostCheckoutHook } from './hook';

describe('installPostCheckoutHook', () => {
  it('installs the hook when none exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      expect(await installPostCheckoutHook(root)).toBe(true);
      expect(await readFile(hookPath(root), 'utf8')).toContain('branchly on-checkout');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('leaves an existing hook untouched', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-hook-'));
    try {
      await installPostCheckoutHook(root);
      expect(await installPostCheckoutHook(root)).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

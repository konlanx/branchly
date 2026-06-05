import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDirenvResolver, upsertExport } from './index';

describe('upsertExport', () => {
  it('appends an export to empty content', () => {
    expect(upsertExport('', 'DATABASE_URL', 'postgres://x')).toBe('export DATABASE_URL=postgres://x\n');
  });

  it('replaces an existing export of the same key', () => {
    expect(upsertExport('export DATABASE_URL=old\nexport OTHER=1\n', 'DATABASE_URL', 'new')).toBe(
      'export DATABASE_URL=new\nexport OTHER=1\n',
    );
  });

  it('is idempotent when the line already matches', () => {
    const content = 'export DATABASE_URL=same\n';
    expect(upsertExport(content, 'DATABASE_URL', 'same')).toBe(content);
  });
});

describe('createDirenvResolver', () => {
  it('writes an export line into .envrc', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-direnv-'));
    try {
      await createDirenvResolver({ cwd: root }).inject('postgres://localhost/app_main');
      expect(await readFile(join(root, '.envrc'), 'utf8')).toBe('export DATABASE_URL=postgres://localhost/app_main\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

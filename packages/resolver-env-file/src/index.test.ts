import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createEnvFileResolver, upsertLine } from './index';

describe('upsertLine', () => {
  it('appends the key to empty content', () => {
    expect(upsertLine('', 'DATABASE_URL', 'postgres://x')).toBe('DATABASE_URL=postgres://x\n');
  });

  it('appends the key when it is absent', () => {
    expect(upsertLine('OTHER=1\n', 'DATABASE_URL', 'postgres://x')).toBe('OTHER=1\nDATABASE_URL=postgres://x\n');
  });

  it('replaces the key when it is present', () => {
    expect(upsertLine('DATABASE_URL=old\nOTHER=1\n', 'DATABASE_URL', 'new')).toBe('DATABASE_URL=new\nOTHER=1\n');
  });

  it('is idempotent when the line already matches', () => {
    const content = 'DATABASE_URL=same\n';
    expect(upsertLine(content, 'DATABASE_URL', 'same')).toBe(content);
  });
});

describe('createEnvFileResolver', () => {
  it('writes the connection into the configured env file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-env-'));
    try {
      const resolver = createEnvFileResolver({ cwd: root, file: '.env', key: 'DATABASE_URL' });
      await resolver.inject('postgres://localhost/app_main');
      expect(await readFile(join(root, '.env'), 'utf8')).toBe('DATABASE_URL=postgres://localhost/app_main\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('updates the key in place on a second injection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-env-'));
    try {
      const resolver = createEnvFileResolver({ cwd: root });
      await resolver.inject('postgres://localhost/first');
      await resolver.inject('postgres://localhost/second');
      expect(await readFile(join(root, '.env'), 'utf8')).toBe('DATABASE_URL=postgres://localhost/second\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

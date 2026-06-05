import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { detectMigrator, detectStack } from './detect';

describe('detectMigrator', () => {
  it('detects prisma from its schema file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-detect-'));
    try {
      await mkdir(join(root, 'prisma'), { recursive: true });
      await writeFile(join(root, 'prisma', 'schema.prisma'), 'datasource db {}\n', 'utf8');
      expect(await detectMigrator(root)).toBe('prisma');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('returns null when no migrator is detected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-detect-'));
    try {
      expect(await detectMigrator(root)).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('detectStack', () => {
  it('falls back to sensible defaults', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-detect-'));
    try {
      expect(await detectStack(root, {})).toEqual({ migrator: 'prisma', datasource: 'postgres', resolver: 'env-file' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('detects the full stack from a prisma schema with a mysql provider', async () => {
    const root = await mkdtemp(join(tmpdir(), 'branchly-detect-'));
    try {
      await mkdir(join(root, 'prisma'), { recursive: true });
      await writeFile(join(root, 'prisma', 'schema.prisma'), 'datasource db {\n  provider = "mysql"\n}\n', 'utf8');
      expect(await detectStack(root, {})).toEqual({ migrator: 'prisma', datasource: 'mysql', resolver: 'env-file' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

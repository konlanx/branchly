import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { datasourceFromUrl, detectDatasource } from './detect-datasource';

const withProjectDir = async (work: (root: string) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'branchly-detect-ds-'));
  try {
    await work(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
};

const writePrismaSchema = async (root: string, provider: string): Promise<void> => {
  await mkdir(join(root, 'prisma'), { recursive: true });
  await writeFile(
    join(root, 'prisma', 'schema.prisma'),
    `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${provider}"\n  url      = env("DATABASE_URL")\n}\n`,
    'utf8',
  );
};

describe('datasourceFromUrl', () => {
  it('maps mysql urls to the mysql datasource', () => {
    expect(datasourceFromUrl('mysql://root:pw@localhost:3306/app')).toBe('mysql');
  });

  it('maps postgres and postgresql urls to the postgres datasource', () => {
    expect(datasourceFromUrl('postgres://user:pw@localhost:5432/app')).toBe('postgres');
    expect(datasourceFromUrl('postgresql://user:pw@localhost:5432/app')).toBe('postgres');
  });

  it('maps file urls to the sqlite datasource', () => {
    expect(datasourceFromUrl('file:./dev.db')).toBe('sqlite');
  });

  it('returns null for unknown schemes and unparseable values', () => {
    expect(datasourceFromUrl('mongodb://localhost:27017/app')).toBe(null);
    expect(datasourceFromUrl('not a url')).toBe(null);
    expect(datasourceFromUrl(undefined)).toBe(null);
  });
});

describe('detectDatasource', () => {
  it('prefers the connection string over the orm config', () =>
    withProjectDir(async (root) => {
      await writePrismaSchema(root, 'postgresql');
      expect(await detectDatasource(root, { DATABASE_URL: 'mysql://root:pw@localhost:3306/app' })).toBe('mysql');
    }));

  it('reads the provider from the prisma datasource block, ignoring the generator', () =>
    withProjectDir(async (root) => {
      await writePrismaSchema(root, 'mysql');
      expect(await detectDatasource(root, {})).toBe('mysql');
    }));

  it('reads the dialect from a drizzle config', () =>
    withProjectDir(async (root) => {
      await writeFile(join(root, 'drizzle.config.ts'), "export default { dialect: 'sqlite' };\n", 'utf8');
      expect(await detectDatasource(root, {})).toBe('sqlite');
    }));

  it('reads the client from a knexfile', () =>
    withProjectDir(async (root) => {
      await writeFile(join(root, 'knexfile.js'), "module.exports = { client: 'mysql2' };\n", 'utf8');
      expect(await detectDatasource(root, {})).toBe('mysql');
    }));

  it('reads the client from a typescript knexfile', () =>
    withProjectDir(async (root) => {
      await writeFile(join(root, 'knexfile.ts'), "export default { client: 'pg' };\n", 'utf8');
      expect(await detectDatasource(root, {})).toBe('postgres');
    }));

  it('falls back to the orm config when the connection string scheme is unknown', () =>
    withProjectDir(async (root) => {
      await writePrismaSchema(root, 'mysql');
      expect(await detectDatasource(root, { DATABASE_URL: 'mongodb://localhost:27017/app' })).toBe('mysql');
    }));

  it('defaults to postgres when nothing is detectable', () =>
    withProjectDir(async (root) => {
      expect(await detectDatasource(root, {})).toBe('postgres');
    }));
});

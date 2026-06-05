import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import pg from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const WORKSPACE_ROOT = join(import.meta.dirname, '..', '..', '..');
const PACKAGES = ['core', 'vcs-git', 'migrator-prisma', 'datasource-postgres', 'resolver-env-file'];
const adminUrl = process.env.BRANCHLY_TEST_PG_URL;
const suite = adminUrl === undefined || adminUrl.length === 0 ? describe.skip : describe;

const SCHEMA = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;
const MIGRATION_LOCK = 'provider = "postgresql"\n';
const INIT_SQL = 'CREATE TABLE "Widget" (\n  "id" SERIAL PRIMARY KEY,\n  "name" TEXT NOT NULL\n);\n';
const COLOR_SQL = 'ALTER TABLE "Widget" ADD COLUMN "color" TEXT;\n';
const SEED = `import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('INSERT INTO "Widget" (name) VALUES ($1)', ['seeded']);
await client.end();
`;
const CONFIG = `import { defineConfig, env } from 'branchly';

export default defineConfig({
  vcs: 'git',
  migrator: { use: 'prisma', seed: 'node prisma/seed.mjs' },
  datasource: { use: 'postgres', admin: env('BRANCHLY_DATABASE_URL'), prefix: 'e2e' },
  resolver: { use: 'env-file', file: '.env', key: 'DATABASE_URL' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
});
`;

const packs: { dir: string; tarballs: string[] } = { dir: '', tarballs: [] };

const run = (command: string, args: readonly string[], cwd: string): Promise<string> =>
  execFileAsync(command, [...args], { cwd, env: process.env, maxBuffer: 16 * 1024 * 1024 }).then(
    ({ stdout }) => stdout,
  );

const git = (cwd: string, args: readonly string[]): Promise<string> =>
  run('git', ['-c', 'user.email=e2e@branchly.test', '-c', 'user.name=branchly-e2e', ...args], cwd);

const queryRow = async (connectionString: string, sql: string): Promise<Record<string, unknown> | null> => {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(sql);
    const rows = result.rows as Record<string, unknown>[];
    return rows[0] ?? null;
  } finally {
    await client.end();
  }
};

const resolvedUrl = async (fixture: string): Promise<string> => {
  const content = await readFile(join(fixture, '.env'), 'utf8');
  const line = content.split('\n').find((entry) => entry.startsWith('DATABASE_URL='));
  if (line === undefined) {
    throw new Error('branchly did not write DATABASE_URL to .env');
  }
  return line.slice('DATABASE_URL='.length);
};

const widgetColumn = (connectionString: string, column: string): Promise<Record<string, unknown> | null> =>
  queryRow(
    connectionString,
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'Widget' AND column_name = '${column}'`,
  );

const writeFixtureFiles = async (fixture: string, admin: string): Promise<void> => {
  await mkdir(join(fixture, 'prisma', 'migrations', '20240101000000_init'), { recursive: true });
  await writeFile(join(fixture, 'prisma', 'schema.prisma'), SCHEMA, 'utf8');
  await writeFile(join(fixture, 'prisma', 'migrations', 'migration_lock.toml'), MIGRATION_LOCK, 'utf8');
  await writeFile(join(fixture, 'prisma', 'migrations', '20240101000000_init', 'migration.sql'), INIT_SQL, 'utf8');
  await writeFile(join(fixture, 'prisma', 'seed.mjs'), SEED, 'utf8');
  await writeFile(join(fixture, 'branchly.config.ts'), CONFIG, 'utf8');
  await writeFile(join(fixture, '.env'), `BRANCHLY_DATABASE_URL=${admin}\n`, 'utf8');
  await writeFile(join(fixture, '.gitignore'), 'node_modules\n.env\n.branchly\n', 'utf8');
};

const databaseExists = async (admin: string, datname: string): Promise<boolean> => {
  const row = await queryRow(admin, `SELECT 1 AS present FROM pg_database WHERE datname = '${datname}'`);
  return row !== null;
};

const dropDatabase = async (admin: string, datname: string): Promise<void> => {
  const client = new pg.Client({ connectionString: admin });
  await client.connect();
  try {
    await client.query(`DROP DATABASE IF EXISTS "${datname}"`);
  } finally {
    await client.end();
  }
};

const mainFingerprint = async (fixture: string): Promise<string> => {
  const content = await readFile(join(fixture, '.git', 'branchly', 'manifest.json'), 'utf8');
  const manifest = JSON.parse(content) as { entries: { slug: string; fingerprint: string }[] };
  const entry = manifest.entries.find((item) => item.slug === 'main');
  if (entry === undefined) {
    throw new Error('main entry missing from the manifest');
  }
  return entry.fingerprint;
};

const dropTestDatabases = async (admin: string): Promise<void> => {
  const client = new pg.Client({ connectionString: admin });
  await client.connect();
  try {
    const result = await client.query("SELECT datname FROM pg_database WHERE datname LIKE 'e2e\\_%'");
    const names = (result.rows as { datname: string }[]).map((row) => row.datname);
    await names.reduce(async (previous, name) => {
      await previous;
      await client.query(`DROP DATABASE IF EXISTS "${name}"`);
    }, Promise.resolve());
  } finally {
    await client.end();
  }
};

suite('branchly end-to-end · prisma + postgres + git', () => {
  beforeAll(async () => {
    if (adminUrl === undefined || adminUrl.length === 0) {
      return;
    }
    await run('pnpm', ['-r', 'run', 'build'], WORKSPACE_ROOT);
    packs.dir = await mkdtemp(join(tmpdir(), 'branchly-e2e-packs-'));
    await Promise.all(
      PACKAGES.map((name) =>
        run('pnpm', ['pack', '--pack-destination', packs.dir], join(WORKSPACE_ROOT, 'packages', name)),
      ),
    );
    packs.tarballs = (await readdir(packs.dir))
      .filter((name) => name.endsWith('.tgz'))
      .map((name) => join(packs.dir, name));
  });

  it('provisions, clones from snapshots, and fast-paths per-branch databases across checkouts', async () => {
    const admin = process.env.BRANCHLY_TEST_PG_URL;
    if (admin === undefined || admin.length === 0) {
      return;
    }
    const fixture = await mkdtemp(join(tmpdir(), 'branchly-e2e-'));
    try {
      await writeFile(join(fixture, 'package.json'), '{ "name": "branchly-e2e-fixture", "private": true }\n', 'utf8');
      await run('npm', ['install', '--no-audit', '--no-fund', ...packs.tarballs, 'prisma@6', 'pg@8'], fixture);
      await writeFixtureFiles(fixture, admin);
      await git(fixture, ['init', '-b', 'main']);
      await git(fixture, ['add', '-A']);
      await git(fixture, ['commit', '-m', 'init']);

      await run('npx', ['--no-install', 'branchly', 'sync', '--quiet'], fixture);
      const mainUrl = await resolvedUrl(fixture);
      expect(await queryRow(mainUrl, 'SELECT count(*)::int AS count FROM "Widget"')).toEqual({ count: 1 });
      expect(await widgetColumn(mainUrl, 'color')).toBeNull();

      await run(
        'npx',
        [
          '--no-install',
          'branchly',
          'run',
          '--',
          'node',
          '-e',
          "require('node:fs').writeFileSync('run-env.txt', process.env.DATABASE_URL ?? '')",
        ],
        fixture,
      );
      expect((await readFile(join(fixture, 'run-env.txt'), 'utf8')).trim()).toBe(mainUrl);

      await git(fixture, ['checkout', '-b', 'feature/color']);
      await mkdir(join(fixture, 'prisma', 'migrations', '20240102000000_color'), { recursive: true });
      await writeFile(
        join(fixture, 'prisma', 'migrations', '20240102000000_color', 'migration.sql'),
        COLOR_SQL,
        'utf8',
      );
      await git(fixture, ['add', '-A']);
      await git(fixture, ['commit', '-m', 'color']);

      await run('npx', ['--no-install', 'branchly', 'sync', '--quiet'], fixture);
      const featureUrl = await resolvedUrl(fixture);
      expect(featureUrl).not.toBe(mainUrl);
      expect(await widgetColumn(featureUrl, 'color')).toEqual({ column_name: 'color' });
      expect(await queryRow(featureUrl, 'SELECT count(*)::int AS count FROM "Widget"')).toEqual({ count: 1 });

      await git(fixture, ['checkout', 'main']);
      const fastPathOutput = await run('npx', ['--no-install', 'branchly', 'sync'], fixture);
      expect(fastPathOutput).toContain('already in sync');
      expect(await widgetColumn(mainUrl, 'color')).toBeNull();

      const fingerprint = await mainFingerprint(fixture);
      expect(await databaseExists(admin, `e2e___snapshot__${fingerprint}`)).toBe(true);

      await git(fixture, ['checkout', '-b', 'sibling']);
      await dropDatabase(admin, `e2e_main__${fingerprint}`);
      await run('npx', ['--no-install', 'branchly', 'sync', '--quiet'], fixture);
      const siblingUrl = await resolvedUrl(fixture);
      expect(siblingUrl).not.toBe(mainUrl);
      expect(await queryRow(siblingUrl, 'SELECT count(*)::int AS count FROM "Widget"')).toEqual({ count: 1 });
      expect(await widgetColumn(siblingUrl, 'color')).toBeNull();

      await dropTestDatabases(admin);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  });
});

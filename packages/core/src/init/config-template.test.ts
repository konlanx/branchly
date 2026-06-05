import { describe, expect, it } from 'vitest';

import { renderConfig } from './config-template';

describe('renderConfig', () => {
  it('renders a config that derives everything from the existing database url', () => {
    const content = renderConfig({
      migrator: 'prisma',
      datasource: 'postgres',
      resolver: 'env-file',
      databaseUrlEnv: 'DATABASE_URL',
    });
    expect(content).toContain("migrator: { use: 'prisma' }");
    expect(content).toContain("url: env('DATABASE_URL')");
    expect(content).toContain("key: 'DATABASE_URL'");
    expect(content).toContain('prune: { autoDropDeleted: true, maxAgeDays: 30, nudge: true }');
    expect(content).toContain("import { defineConfig, env } from 'branchly'");
  });

  it('renders a mysql datasource with the same url-derived shape', () => {
    const content = renderConfig({
      migrator: 'prisma',
      datasource: 'mysql',
      resolver: 'env-file',
      databaseUrlEnv: 'DATABASE_URL',
    });
    expect(content).toContain("datasource: { use: 'mysql', url: env('DATABASE_URL'), prefix: 'app' }");
  });

  it('renders a sqlite datasource without a url and without the env import', () => {
    const content = renderConfig({
      migrator: 'drizzle',
      datasource: 'sqlite',
      resolver: 'env-file',
      databaseUrlEnv: 'DATABASE_URL',
    });
    expect(content).toContain("datasource: { use: 'sqlite' }");
    expect(content).not.toContain('env(');
    expect(content).toContain("import { defineConfig } from 'branchly'");
  });
});

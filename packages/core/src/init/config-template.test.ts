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
    expect(content).toContain("import { defineConfig, env } from 'branchly'");
  });
});

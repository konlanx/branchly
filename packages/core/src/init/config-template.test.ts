import { describe, expect, it } from 'vitest';

import { renderConfig } from './config-template';

describe('renderConfig', () => {
  it('renders a config with the detected adapters', () => {
    const content = renderConfig({
      migrator: 'prisma',
      datasource: 'postgres',
      resolver: 'env-file',
      urlEnv: 'DATABASE_URL',
    });
    expect(content).toContain("migrator: { use: 'prisma' }");
    expect(content).toContain("admin: env('DATABASE_URL')");
    expect(content).toContain("import { defineConfig, env } from 'branchly'");
  });
});

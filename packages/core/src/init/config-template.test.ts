import { describe, expect, it } from 'vitest';

import { renderConfig } from './config-template';

describe('renderConfig', () => {
  it('renders a config with the detected adapters and a dedicated admin variable', () => {
    const content = renderConfig({
      migrator: 'prisma',
      datasource: 'postgres',
      resolver: 'env-file',
      adminEnv: 'BRANCHLY_DATABASE_URL',
      appEnv: 'DATABASE_URL',
    });
    expect(content).toContain("migrator: { use: 'prisma' }");
    expect(content).toContain("admin: env('BRANCHLY_DATABASE_URL')");
    expect(content).toContain("key: 'DATABASE_URL'");
    expect(content).toContain("import { defineConfig, env } from 'branchly'");
  });
});

export interface ConfigTemplateInput {
  readonly migrator: string;
  readonly datasource: string;
  readonly resolver: string;
  readonly databaseUrlEnv: string;
}

export const renderConfig = (input: ConfigTemplateInput): string =>
  `import { defineConfig, env } from 'branchly';

export default defineConfig({
  vcs: 'git',
  migrator: { use: '${input.migrator}' },
  datasource: { use: '${input.datasource}', url: env('${input.databaseUrlEnv}'), prefix: 'app' },
  resolver: { use: '${input.resolver}', file: '.env', key: '${input.databaseUrlEnv}' },
  protect: ['main', 'master', 'production'],
  cache: { enabled: true, max: 10, base: 'main' },
});
`;

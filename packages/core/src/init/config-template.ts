export interface ConfigTemplateInput {
  readonly migrator: string;
  readonly datasource: string;
  readonly resolver: string;
  readonly databaseUrlEnv: string;
}

const usesDatabaseUrl = (input: ConfigTemplateInput): boolean => input.datasource !== 'sqlite';

const importLine = (input: ConfigTemplateInput): string =>
  usesDatabaseUrl(input) ? `import { defineConfig, env } from 'branchly';` : `import { defineConfig } from 'branchly';`;

const datasourceLine = (input: ConfigTemplateInput): string =>
  usesDatabaseUrl(input)
    ? `datasource: { use: '${input.datasource}', url: env('${input.databaseUrlEnv}'), prefix: 'app' },`
    : `datasource: { use: '${input.datasource}' },`;

export const renderConfig = (input: ConfigTemplateInput): string =>
  `${importLine(input)}

export default defineConfig({
  vcs: 'git',
  migrator: { use: '${input.migrator}' },
  ${datasourceLine(input)}
  resolver: { use: '${input.resolver}', file: '.env', key: '${input.databaseUrlEnv}' },
  protect: ['main', 'master', 'production'],
  cache: { enabled: true, max: 10, base: 'main' },
  prune: { autoDropDeleted: true, maxAgeDays: 30, nudge: true },
});
`;

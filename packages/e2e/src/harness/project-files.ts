import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const branchlyConfig = (
  migrator: string,
  datasource: string,
  prefix: string,
): string => `import { defineConfig, env } from 'branchly';

export default defineConfig({
  vcs: 'git',
  migrator: ${migrator},
  datasource: { use: '${datasource}', url: env('DATABASE_URL'), prefix: '${prefix}' },
  resolver: { use: 'env-file', file: '.env', key: 'DATABASE_URL' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
});
`;

export const writeCommonProjectFiles = async (fixture: string, adminUrl: string, config: string): Promise<void> => {
  await writeFile(join(fixture, 'branchly.config.ts'), config, 'utf8');
  await writeFile(join(fixture, '.env'), `DATABASE_URL=${adminUrl}\n`, 'utf8');
  await writeFile(join(fixture, '.gitignore'), 'node_modules\n.env\n.branchly\n', 'utf8');
};

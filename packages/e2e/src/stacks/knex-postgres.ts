import { addKnexColorMigration, KNEX_MIGRATOR_CONFIG, writeKnexProject } from './knex-project';
import { createPostgresAdmin, createPostgresWidgetProbe } from './postgres-admin';
import { branchlyConfig, writeCommonProjectFiles } from '../harness/project-files';
import type { E2eStack } from '../harness/stack';

const PREFIX = 'e2eknex';

export const createKnexPostgresStack = (adminUrl: string): E2eStack => ({
  label: 'knex + postgres',
  prefix: PREFIX,
  dependencies: ['knex@3', 'pg@8'],
  admin: createPostgresAdmin(adminUrl, PREFIX),
  writeProjectFiles: async (fixture) => {
    await writeKnexProject(fixture);
    await writeCommonProjectFiles(fixture, adminUrl, branchlyConfig(KNEX_MIGRATOR_CONFIG, 'postgres', PREFIX));
  },
  addColorMigration: (fixture) => addKnexColorMigration(fixture),
  ...createPostgresWidgetProbe('widget'),
});

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const KNEX_MIGRATOR_CONFIG = "{ use: 'knex', seed: 'npx knex seed:run' }";

const KNEXFILE = `module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: { directory: './migrations' },
  seeds: { directory: './seeds' },
};
`;

const INIT_MIGRATION = `exports.up = (knex) =>
  knex.schema.createTable('widget', (table) => {
    table.increments('id');
    table.text('name').notNullable();
  });

exports.down = (knex) => knex.schema.dropTable('widget');
`;

const COLOR_MIGRATION = `exports.up = (knex) =>
  knex.schema.alterTable('widget', (table) => {
    table.text('color');
  });

exports.down = (knex) =>
  knex.schema.alterTable('widget', (table) => {
    table.dropColumn('color');
  });
`;

const SEED = `exports.seed = (knex) => knex('widget').insert({ name: 'seeded' });
`;

export const writeKnexProject = async (fixture: string): Promise<void> => {
  await mkdir(join(fixture, 'migrations'), { recursive: true });
  await mkdir(join(fixture, 'seeds'), { recursive: true });
  await writeFile(join(fixture, 'knexfile.js'), KNEXFILE, 'utf8');
  await writeFile(join(fixture, 'migrations', '20240101000000_init.js'), INIT_MIGRATION, 'utf8');
  await writeFile(join(fixture, 'seeds', 'widgets.js'), SEED, 'utf8');
};

export const addKnexColorMigration = async (fixture: string): Promise<void> => {
  await writeFile(join(fixture, 'migrations', '20240102000000_color.js'), COLOR_MIGRATION, 'utf8');
};

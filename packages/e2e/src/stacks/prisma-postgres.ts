import { createPostgresAdmin, createPostgresWidgetProbe } from './postgres-admin';
import { addPrismaColorMigration, PRISMA_MIGRATOR_CONFIG, writePrismaProject } from './prisma-project';
import { branchlyConfig, writeCommonProjectFiles } from '../harness/project-files';
import type { E2eStack } from '../harness/stack';

const PREFIX = 'e2eprisma';
const INIT_SQL = 'CREATE TABLE "Widget" (\n  "id" SERIAL PRIMARY KEY,\n  "name" TEXT NOT NULL\n);\n';
const COLOR_SQL = 'ALTER TABLE "Widget" ADD COLUMN "color" TEXT;\n';
const SEED = `import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query('INSERT INTO "Widget" (name) VALUES ($1)', ['seeded']);
await client.end();
`;

export const createPrismaPostgresStack = (adminUrl: string): E2eStack => ({
  label: 'prisma + postgres',
  prefix: PREFIX,
  dependencies: ['prisma@6', 'pg@8'],
  admin: createPostgresAdmin(adminUrl, PREFIX),
  writeProjectFiles: async (fixture) => {
    await writePrismaProject(fixture, { provider: 'postgresql', initSql: INIT_SQL, seedScript: SEED });
    await writeCommonProjectFiles(fixture, adminUrl, branchlyConfig(PRISMA_MIGRATOR_CONFIG, 'postgres', PREFIX));
  },
  addColorMigration: (fixture) => addPrismaColorMigration(fixture, COLOR_SQL),
  ...createPostgresWidgetProbe('Widget'),
});

import { createMysqlAdmin, createMysqlWidgetProbe } from './mysql-admin';
import { addPrismaColorMigration, PRISMA_MIGRATOR_CONFIG, writePrismaProject } from './prisma-project';
import { branchlyConfig, writeCommonProjectFiles } from '../harness/project-files';
import type { E2eStack } from '../harness/stack';

const PREFIX = 'e2emysql';
const INIT_SQL =
  'CREATE TABLE `Widget` (\n  `id` INTEGER NOT NULL AUTO_INCREMENT,\n  `name` TEXT NOT NULL,\n  PRIMARY KEY (`id`)\n);\n';
const COLOR_SQL = 'ALTER TABLE `Widget` ADD COLUMN `color` TEXT;\n';
const SEED = `import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
await connection.query('INSERT INTO Widget (name) VALUES (?)', ['seeded']);
await connection.end();
`;

export const createPrismaMysqlStack = (adminUrl: string): E2eStack => ({
  label: 'prisma + mysql',
  prefix: PREFIX,
  dependencies: ['prisma@6', 'mysql2@3'],
  admin: createMysqlAdmin(adminUrl, PREFIX),
  writeProjectFiles: async (fixture) => {
    await writePrismaProject(fixture, { provider: 'mysql', initSql: INIT_SQL, seedScript: SEED });
    await writeCommonProjectFiles(fixture, adminUrl, branchlyConfig(PRISMA_MIGRATOR_CONFIG, 'mysql', PREFIX));
  },
  addColorMigration: (fixture) => addPrismaColorMigration(fixture, COLOR_SQL),
  ...createMysqlWidgetProbe('Widget'),
});

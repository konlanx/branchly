import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const PRISMA_MIGRATOR_CONFIG = "{ use: 'prisma', seed: 'node prisma/seed.mjs' }";

export interface PrismaProjectFiles {
  readonly provider: string;
  readonly initSql: string;
  readonly seedScript: string;
}

const prismaSchema = (provider: string): string => `datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}
`;

export const writePrismaProject = async (fixture: string, files: PrismaProjectFiles): Promise<void> => {
  const migrationsDir = join(fixture, 'prisma', 'migrations');
  await mkdir(join(migrationsDir, '20240101000000_init'), { recursive: true });
  await writeFile(join(fixture, 'prisma', 'schema.prisma'), prismaSchema(files.provider), 'utf8');
  await writeFile(join(migrationsDir, 'migration_lock.toml'), `provider = "${files.provider}"\n`, 'utf8');
  await writeFile(join(migrationsDir, '20240101000000_init', 'migration.sql'), files.initSql, 'utf8');
  await writeFile(join(fixture, 'prisma', 'seed.mjs'), files.seedScript, 'utf8');
};

export const addPrismaColorMigration = async (fixture: string, colorSql: string): Promise<void> => {
  const migrationDir = join(fixture, 'prisma', 'migrations', '20240102000000_color');
  await mkdir(migrationDir, { recursive: true });
  await writeFile(join(migrationDir, 'migration.sql'), colorSql, 'utf8');
};

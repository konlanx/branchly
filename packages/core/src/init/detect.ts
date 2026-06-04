import { access } from 'node:fs/promises';
import { join } from 'node:path';

export interface DetectedStack {
  readonly migrator: string;
  readonly datasource: string;
  readonly resolver: string;
}

const MIGRATOR_MARKERS = [
  { file: 'prisma/schema.prisma', use: 'prisma' },
  { file: 'drizzle.config.ts', use: 'drizzle' },
  { file: 'knexfile.js', use: 'knex' },
];

const fileExists = (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false);

export const detectMigrator = async (cwd: string): Promise<string | null> => {
  const checks = await Promise.all(
    MIGRATOR_MARKERS.map(async (marker) => ({ use: marker.use, found: await fileExists(join(cwd, marker.file)) })),
  );
  return checks.find((check) => check.found)?.use ?? null;
};

export const detectStack = async (cwd: string): Promise<DetectedStack> => ({
  migrator: (await detectMigrator(cwd)) ?? 'prisma',
  datasource: 'postgres',
  resolver: 'env-file',
});

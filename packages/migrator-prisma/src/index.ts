import { exec } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import type { MigratorAdapter } from 'branchly';

const execAsync = promisify(exec);

const FINGERPRINT_LENGTH = 16;
const DEFAULT_MIGRATIONS_DIR = 'prisma/migrations';
const DEFAULT_APPLY_COMMAND = 'npx prisma migrate deploy';
const DEFAULT_URL_ENV = 'DATABASE_URL';

export type CommandRunner = (command: string, env: NodeJS.ProcessEnv, cwd: string) => Promise<void>;

export interface PrismaMigratorOptions {
  readonly migrationsDir?: string;
  readonly seed?: string;
  readonly applyCommand?: string;
  readonly urlEnv?: string;
  readonly cwd?: string;
  readonly run?: CommandRunner;
}

export const fingerprintNames = (names: readonly string[]): string =>
  createHash('sha256')
    .update([...names].sort().join('\n'))
    .digest('hex')
    .slice(0, FINGERPRINT_LENGTH);

const listMigrationIds = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
};

const defaultRunner: CommandRunner = async (command, env, cwd) => {
  await execAsync(command, { env, cwd });
};

const buildEnv = (urlEnv: string, connection: string): NodeJS.ProcessEnv => ({ ...process.env, [urlEnv]: connection });

export const createPrismaMigrator = (options: PrismaMigratorOptions = {}): MigratorAdapter => {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const applyCommand = options.applyCommand ?? DEFAULT_APPLY_COMMAND;
  const urlEnv = options.urlEnv ?? DEFAULT_URL_ENV;
  const cwd = options.cwd ?? process.cwd();
  const run = options.run ?? defaultRunner;
  return {
    id: 'prisma',
    apiVersion: 1,
    fingerprint: async () => fingerprintNames(await listMigrationIds(join(cwd, migrationsDir))),
    apply: (connection) => run(applyCommand, buildEnv(urlEnv, connection), cwd),
    seed: async (connection) => {
      if (options.seed === undefined) {
        return;
      }
      await run(options.seed, buildEnv(urlEnv, connection), cwd);
    },
  };
};

export default createPrismaMigrator;

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

import { KNEXFILE_VARIANTS } from './knexfile-variants';

export const DATABASE_URL_ENV = 'DATABASE_URL';

const SCHEME_DATASOURCES: Readonly<Record<string, string>> = {
  postgres: 'postgres',
  postgresql: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  file: 'sqlite',
};

const PROVIDER_DATASOURCES: Readonly<Record<string, string>> = {
  postgresql: 'postgres',
  postgres: 'postgres',
  pg: 'postgres',
  cockroachdb: 'postgres',
  mysql: 'mysql',
  mysql2: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  sqlite3: 'sqlite',
  'better-sqlite3': 'sqlite',
};

interface ProviderMarker {
  readonly file: string;
  readonly pattern: RegExp;
}

const PROVIDER_MARKERS: readonly ProviderMarker[] = [
  { file: 'prisma/schema.prisma', pattern: /datasource\s+\w+\s*\{[^}]*provider\s*=\s*"([^"]+)"/ },
  { file: 'drizzle.config.ts', pattern: /dialect:\s*['"]([^'"]+)['"]/ },
  ...KNEXFILE_VARIANTS.map((file) => ({ file, pattern: /client:\s*['"]([^'"]+)['"]/ })),
];

const schemeOf = (connection: string): string | null => {
  try {
    return new URL(connection).protocol.slice(0, -1);
  } catch {
    return null;
  }
};

export const datasourceFromUrl = (connection: string | undefined): string | null => {
  const scheme = connection === undefined ? null : schemeOf(connection);
  return scheme === null ? null : (SCHEME_DATASOURCES[scheme] ?? null);
};

const datasourceFromMarker = async (cwd: string, marker: ProviderMarker): Promise<string | null> => {
  const content = await readFile(join(cwd, marker.file), 'utf8').catch(() => null);
  const provider = content === null ? undefined : marker.pattern.exec(content)?.[1];
  return provider === undefined ? null : (PROVIDER_DATASOURCES[provider] ?? null);
};

export const datasourceFromOrmConfig = async (cwd: string): Promise<string | null> => {
  const detected = await Promise.all(PROVIDER_MARKERS.map((marker) => datasourceFromMarker(cwd, marker)));
  return detected.find((datasource) => datasource !== null) ?? null;
};

export const detectDatasource = async (cwd: string, env: NodeJS.ProcessEnv = process.env): Promise<string> =>
  datasourceFromUrl(env[DATABASE_URL_ENV]) ?? (await datasourceFromOrmConfig(cwd)) ?? 'postgres';

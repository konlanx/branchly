import type { BranchKey } from 'branchly';

const MYSQL_NAME_PATTERN = /^[a-z0-9_]+$/;
const MYSQL_NAME_MAX_LENGTH = 64;

export const databaseName = (prefix: string, key: BranchKey): string => {
  const name = `${prefix}_${key}`;
  if (!MYSQL_NAME_PATTERN.test(name) || name.length > MYSQL_NAME_MAX_LENGTH) {
    throw new Error(`branchly: branch key "${key}" does not map to a valid MySQL database name ("${name}").`);
  }
  return name;
};

export const withDatabase = (connection: string, database: string): string => {
  const url = new URL(connection);
  url.pathname = `/${database}`;
  return url.toString();
};

export const prefixLikePattern = (prefix: string): string =>
  `${prefix.replaceAll('\\', '\\\\').replaceAll('_', '\\_').replaceAll('%', '\\%')}\\_%`;

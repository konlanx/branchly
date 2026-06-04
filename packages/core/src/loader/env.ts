import process from 'node:process';

import type { EnvRef } from '../config';

export const isEnvRef = (value: unknown): value is EnvRef =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'env';

export const resolveEnv = (value: string | EnvRef): string => {
  if (!isEnvRef(value)) {
    return value;
  }
  const resolved = process.env[value.name];
  if (resolved === undefined) {
    throw new Error(`branchly needs the "${value.name}" environment variable, but it is not set.`);
  }
  return resolved;
};

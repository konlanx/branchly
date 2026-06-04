import type { MigratorAdapter } from 'branchly';

export interface TrivialMigratorOptions {
  readonly fingerprint?: string;
}

export const createTrivialMigrator = (options: TrivialMigratorOptions = {}): MigratorAdapter => {
  const value = options.fingerprint ?? 'trivial';
  return {
    id: 'trivial',
    apiVersion: 1,
    fingerprint: () => Promise.resolve(value),
    apply: () => Promise.resolve(),
    seed: () => Promise.resolve(),
  };
};

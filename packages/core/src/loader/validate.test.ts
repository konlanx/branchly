import { describe, expect, it } from 'vitest';

import { validateConfig } from './validate';

const validConfig = {
  vcs: 'git',
  migrator: { use: 'prisma', migrationsDir: 'prisma/migrations' },
  datasource: { use: 'postgres', prefix: 'app' },
  resolver: { use: 'env-file', file: '.env', key: 'DATABASE_URL' },
  protect: ['main'],
  cache: { enabled: true, max: 10, base: 'main' },
};

describe('validateConfig', () => {
  it('accepts and returns a well-formed config', () => {
    expect(validateConfig(validConfig)).toEqual(validConfig);
  });

  it('preserves adapter-specific passthrough options', () => {
    expect(validateConfig(validConfig).migrator.migrationsDir).toBe('prisma/migrations');
  });

  it('rejects a config that is not an object', () => {
    expect(() => validateConfig('nope')).toThrow(/config/);
  });

  it('rejects a missing vcs', () => {
    expect(() => validateConfig({ ...validConfig, vcs: undefined })).toThrow(/vcs/);
  });

  it('rejects a malformed cache', () => {
    expect(() => validateConfig({ ...validConfig, cache: { enabled: true } })).toThrow(/cache/);
  });

  it('rejects a protect list that is not all strings', () => {
    expect(() => validateConfig({ ...validConfig, protect: ['main', 42] })).toThrow(/protect/);
  });
});

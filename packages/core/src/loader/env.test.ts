import { afterEach, describe, expect, it, vi } from 'vitest';

import { env } from '../config';
import { isEnvRef, resolveEnv } from './env';

describe('isEnvRef', () => {
  it('recognizes env refs created by env()', () => {
    expect(isEnvRef(env('DATABASE_URL'))).toBe(true);
  });

  it('rejects plain strings, null, and arbitrary objects', () => {
    expect(isEnvRef('DATABASE_URL')).toBe(false);
    expect(isEnvRef(null)).toBe(false);
    expect(isEnvRef({ kind: 'other' })).toBe(false);
  });
});

describe('resolveEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns plain strings unchanged', () => {
    expect(resolveEnv('postgres://localhost/app')).toBe('postgres://localhost/app');
  });

  it('resolves an env ref from the environment', () => {
    vi.stubEnv('BRANCHLY_TEST_URL', 'postgres://stubbed/app');
    expect(resolveEnv(env('BRANCHLY_TEST_URL'))).toBe('postgres://stubbed/app');
  });

  it('throws a clear error when the variable is not set', () => {
    expect(() => resolveEnv(env('BRANCHLY_TEST_DEFINITELY_UNSET'))).toThrow(/BRANCHLY_TEST_DEFINITELY_UNSET/);
  });
});

import { describe, expect, it } from 'vitest';

import { assertApiVersion, selectDefaultFactory } from './adapter';

describe('selectDefaultFactory', () => {
  it('returns the default export when it is a function', () => {
    const factory = (): Record<string, unknown> => ({});
    expect(selectDefaultFactory({ default: factory }, 'pkg')).toBe(factory);
  });

  it('throws when there is no default factory function', () => {
    expect(() => selectDefaultFactory({}, '@branchly/datasource-postgres')).toThrow(/default-export/);
  });
});

describe('assertApiVersion', () => {
  it('accepts a matching api version', () => {
    expect(() => {
      assertApiVersion({ apiVersion: 1 }, 'pkg');
    }).not.toThrow();
  });

  it('rejects a mismatched api version, naming the package and versions', () => {
    expect(() => {
      assertApiVersion({ apiVersion: 2 }, 'pkg');
    }).toThrow(/apiVersion 2/);
  });

  it('rejects an adapter that declares no api version', () => {
    expect(() => {
      assertApiVersion({}, 'pkg');
    }).toThrow(/pkg/);
  });
});

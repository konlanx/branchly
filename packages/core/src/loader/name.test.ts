import { describe, expect, it } from 'vitest';

import { resolvePluginName } from './name';

describe('resolvePluginName', () => {
  it('maps a short name to the conventional @branchly package', () => {
    expect(resolvePluginName('migrator', 'prisma')).toBe('@branchly/migrator-prisma');
    expect(resolvePluginName('datasource', 'postgres')).toBe('@branchly/datasource-postgres');
    expect(resolvePluginName('resolver', 'env-file')).toBe('@branchly/resolver-env-file');
    expect(resolvePluginName('vcs', 'git')).toBe('@branchly/vcs-git');
  });

  it('accepts a fully-qualified scoped package as-is', () => {
    expect(resolvePluginName('migrator', '@acme/migrator-custom')).toBe('@acme/migrator-custom');
  });

  it('accepts a package path as-is', () => {
    expect(resolvePluginName('datasource', 'my-team/datasource')).toBe('my-team/datasource');
  });
});

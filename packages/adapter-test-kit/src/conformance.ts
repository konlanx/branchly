import { describe, expect, it } from 'vitest';

import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter } from 'branchly';

export interface DataProbe {
  readonly write: (connection: string, marker: string) => Promise<void>;
  readonly read: (connection: string) => Promise<string | null>;
}

export interface DatasourceFixture {
  readonly datasource: DatasourceAdapter;
  readonly probe?: DataProbe;
  readonly cleanup: () => Promise<void>;
}

export interface DatasourceConformanceOptions {
  readonly label: string;
  readonly create: () => Promise<DatasourceFixture>;
}

export const describeDatasourceAdapter = (options: DatasourceConformanceOptions): void => {
  describe(`datasource conformance · ${options.label}`, () => {
    it('reports a created database as existing', async () => {
      const fixture = await options.create();
      try {
        await fixture.datasource.create('alpha__fp1');
        expect(await fixture.datasource.exists('alpha__fp1')).toBe(true);
      } finally {
        await fixture.cleanup();
      }
    });

    it('reports a destroyed database as absent', async () => {
      const fixture = await options.create();
      try {
        await fixture.datasource.create('alpha__fp1');
        await fixture.datasource.destroy('alpha__fp1');
        expect(await fixture.datasource.exists('alpha__fp1')).toBe(false);
      } finally {
        await fixture.cleanup();
      }
    });

    it('resolves a key deterministically', async () => {
      const fixture = await options.create();
      try {
        expect(fixture.datasource.resolve('alpha__fp1')).toBe(fixture.datasource.resolve('alpha__fp1'));
      } finally {
        await fixture.cleanup();
      }
    });

    it('lists every created and undestroyed key', async () => {
      const fixture = await options.create();
      try {
        await fixture.datasource.create('alpha__fp1');
        await fixture.datasource.create('beta__fp1');
        await fixture.datasource.destroy('beta__fp1');
        const keys = await fixture.datasource.list();
        expect(keys).toContain('alpha__fp1');
        expect(keys).not.toContain('beta__fp1');
      } finally {
        await fixture.cleanup();
      }
    });

    it('clones into a working copy when instant clone is supported', async () => {
      const fixture = await options.create();
      try {
        if (!fixture.datasource.capabilities.instantClone) {
          return;
        }
        await fixture.datasource.create('src__fp1');
        await fixture.datasource.clone('src__fp1', 'dst__fp1');
        expect(await fixture.datasource.exists('src__fp1')).toBe(true);
        expect(await fixture.datasource.exists('dst__fp1')).toBe(true);
      } finally {
        await fixture.cleanup();
      }
    });

    it('clones into an isolated copy', async () => {
      const fixture = await options.create();
      try {
        const probe = fixture.probe;
        if (!fixture.datasource.capabilities.instantClone || probe === undefined) {
          return;
        }
        await fixture.datasource.create('src__fp1');
        await probe.write(fixture.datasource.resolve('src__fp1'), 'original');
        await fixture.datasource.clone('src__fp1', 'dst__fp1');
        await probe.write(fixture.datasource.resolve('dst__fp1'), 'changed');
        expect(await probe.read(fixture.datasource.resolve('src__fp1'))).toBe('original');
        expect(await probe.read(fixture.datasource.resolve('dst__fp1'))).toBe('changed');
      } finally {
        await fixture.cleanup();
      }
    });

    it('rejects cloning when instant clone is not supported', async () => {
      const fixture = await options.create();
      try {
        if (fixture.datasource.capabilities.instantClone) {
          return;
        }
        await expect(fixture.datasource.clone('a__fp1', 'b__fp1')).rejects.toThrow();
      } finally {
        await fixture.cleanup();
      }
    });
  });
};

export interface MigratorFixture {
  readonly migrator: MigratorAdapter;
  readonly altMigrator?: MigratorAdapter;
  readonly connection: string;
  readonly cleanup: () => Promise<void>;
}

export interface MigratorConformanceOptions {
  readonly label: string;
  readonly create: () => Promise<MigratorFixture>;
}

export const describeMigratorAdapter = (options: MigratorConformanceOptions): void => {
  describe(`migrator conformance · ${options.label}`, () => {
    it('fingerprints deterministically', async () => {
      const fixture = await options.create();
      try {
        expect(await fixture.migrator.fingerprint()).toBe(await fixture.migrator.fingerprint());
      } finally {
        await fixture.cleanup();
      }
    });

    it('changes its fingerprint when the migration set changes', async () => {
      const fixture = await options.create();
      try {
        if (fixture.altMigrator === undefined) {
          return;
        }
        expect(await fixture.migrator.fingerprint()).not.toBe(await fixture.altMigrator.fingerprint());
      } finally {
        await fixture.cleanup();
      }
    });

    it('applies idempotently', async () => {
      const fixture = await options.create();
      try {
        await fixture.migrator.apply(fixture.connection);
        await fixture.migrator.apply(fixture.connection);
      } finally {
        await fixture.cleanup();
      }
    });

    it('seeds without error after applying', async () => {
      const fixture = await options.create();
      try {
        await fixture.migrator.apply(fixture.connection);
        await fixture.migrator.seed(fixture.connection);
      } finally {
        await fixture.cleanup();
      }
    });
  });
};

export interface ResolverFixture {
  readonly resolver: ConnectionResolver;
  readonly observe: () => Promise<string | null>;
  readonly cleanup: () => Promise<void>;
}

export interface ResolverConformanceOptions {
  readonly label: string;
  readonly create: () => Promise<ResolverFixture>;
}

export const describeResolverAdapter = (options: ResolverConformanceOptions): void => {
  describe(`resolver conformance · ${options.label}`, () => {
    it('makes an injected connection observable', async () => {
      const fixture = await options.create();
      try {
        await fixture.resolver.inject('conn://one');
        expect(await fixture.observe()).toBe('conn://one');
      } finally {
        await fixture.cleanup();
      }
    });

    it('overwrites a previously injected connection', async () => {
      const fixture = await options.create();
      try {
        await fixture.resolver.inject('conn://one');
        await fixture.resolver.inject('conn://two');
        expect(await fixture.observe()).toBe('conn://two');
      } finally {
        await fixture.cleanup();
      }
    });
  });
};

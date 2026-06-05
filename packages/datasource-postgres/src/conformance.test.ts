import process from 'node:process';

import { describe, expect, it } from 'vitest';

import { describeDatasourceAdapter } from '@branchly/adapter-test-kit';

import { createPostgresDatasource } from './index';

const adminUrl = process.env.BRANCHLY_TEST_PG_URL;

if (adminUrl === undefined || adminUrl.length === 0) {
  describe.skip('datasource conformance · postgres (set BRANCHLY_TEST_PG_URL to run)', () => {
    it('requires a Postgres server', () => {
      expect(true).toBe(true);
    });
  });
} else {
  const url = adminUrl;
  const uniquePrefix = (): string => `branchly_test_${Math.random().toString(16).slice(2, 10)}`;
  describeDatasourceAdapter({
    label: 'postgres',
    create: () => {
      const datasource = createPostgresDatasource({ url, prefix: uniquePrefix() });
      const cleanup = async (): Promise<void> => {
        const keys = await datasource.list();
        await Promise.all(keys.map((key) => datasource.destroy(key)));
      };
      return Promise.resolve({ datasource, cleanup });
    },
  });
}

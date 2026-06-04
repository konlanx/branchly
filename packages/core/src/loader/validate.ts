import type { AdapterConfig, BranchlyConfig, CacheConfig, DatasourceConfig } from '../config';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) {
    throw new Error(`branchly config: "${label}" must be an object.`);
  }
  return value;
};

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`branchly config: "${label}" must be a string.`);
  }
  return value;
};

const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new Error(`branchly config: "${label}" must be a boolean.`);
  }
  return value;
};

const requireNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`branchly config: "${label}" must be a number.`);
  }
  return value;
};

const requireStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`branchly config: "${label}" must be an array of strings.`);
  }
  return value as string[];
};

const validateAdapter = (value: unknown, label: string): AdapterConfig => {
  const record = requireRecord(value, label);
  requireString(record.use, `${label}.use`);
  return record as AdapterConfig;
};

const validateCache = (value: unknown): CacheConfig => {
  const record = requireRecord(value, 'cache');
  return {
    enabled: requireBoolean(record.enabled, 'cache.enabled'),
    max: requireNumber(record.max, 'cache.max'),
    base: requireString(record.base, 'cache.base'),
  };
};

export const validateConfig = (value: unknown): BranchlyConfig => {
  const record = requireRecord(value, 'config');
  return {
    vcs: requireString(record.vcs, 'vcs'),
    migrator: validateAdapter(record.migrator, 'migrator'),
    datasource: validateAdapter(record.datasource, 'datasource') as DatasourceConfig,
    resolver: validateAdapter(record.resolver, 'resolver'),
    protect: requireStringArray(record.protect, 'protect'),
    cache: validateCache(record.cache),
    quiet: record.quiet === undefined ? undefined : requireBoolean(record.quiet, 'quiet'),
  };
};

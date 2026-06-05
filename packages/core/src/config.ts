export interface EnvRef {
  readonly kind: 'env';
  readonly name: string;
}

export const env = (name: string): EnvRef => ({ kind: 'env', name });

export interface AdapterConfig {
  readonly use: string;
  readonly [option: string]: unknown;
}

export interface DatasourceConfig extends AdapterConfig {
  readonly url?: string | EnvRef;
}

export interface CacheConfig {
  readonly enabled: boolean;
  readonly max: number;
  readonly base: string;
}

export interface BranchlyConfig {
  readonly vcs: string;
  readonly migrator: AdapterConfig;
  readonly datasource: DatasourceConfig;
  readonly resolver: AdapterConfig;
  readonly protect: readonly string[];
  readonly cache: CacheConfig;
  readonly quiet?: boolean;
}

export const defineConfig = (config: BranchlyConfig): BranchlyConfig => config;

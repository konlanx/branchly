import type { AdapterConfig, BranchlyConfig } from '../config';
import type { ConnectionResolver, DatasourceAdapter, MigratorAdapter, Vcs } from '../interfaces';
import { loadAdapter } from '../loader/adapter';
import { isEnvRef, resolveEnv } from '../loader/env';
import { resolvePluginName } from '../loader/name';

export interface Plugins {
  readonly vcs: Vcs;
  readonly migrator: MigratorAdapter;
  readonly datasource: DatasourceAdapter;
  readonly resolver: ConnectionResolver;
}

export type AdapterLoader = (packageName: string, options: Record<string, unknown>, cwd: string) => Promise<unknown>;

export interface LoadPluginsDeps {
  readonly cwd: string;
  readonly load?: AdapterLoader;
}

const resolveValue = (value: unknown): unknown => (isEnvRef(value) ? resolveEnv(value) : value);

const adapterOptions = (config: AdapterConfig, cwd: string): Record<string, unknown> => {
  const resolved = Object.entries(config)
    .filter(([key]) => key !== 'use')
    .map(([key, value]) => [key, resolveValue(value)] as const);
  return { ...Object.fromEntries(resolved), cwd };
};

export const loadPlugins = async (config: BranchlyConfig, deps: LoadPluginsDeps): Promise<Plugins> => {
  const load = deps.load ?? loadAdapter;
  const { cwd } = deps;
  const [vcs, migrator, datasource, resolver] = await Promise.all([
    load(resolvePluginName('vcs', config.vcs), { cwd }, cwd),
    load(resolvePluginName('migrator', config.migrator.use), adapterOptions(config.migrator, cwd), cwd),
    load(resolvePluginName('datasource', config.datasource.use), adapterOptions(config.datasource, cwd), cwd),
    load(resolvePluginName('resolver', config.resolver.use), adapterOptions(config.resolver, cwd), cwd),
  ]);
  return {
    vcs: vcs as Vcs,
    migrator: migrator as MigratorAdapter,
    datasource: datasource as DatasourceAdapter,
    resolver: resolver as ConnectionResolver,
  };
};

import process from 'node:process';

import spawn from 'cross-spawn';

import { loadConfig } from '../loader/config';
import type { AdapterLoader } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';
import { provisionCurrent } from '../runtime/run';

const DEFAULT_KEY = 'DATABASE_URL';

export type Spawner = (command: string, args: readonly string[], env: NodeJS.ProcessEnv) => Promise<number>;

export interface RunOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly command: string;
  readonly args: readonly string[];
  readonly load?: AdapterLoader;
  readonly spawn?: Spawner;
}

const defaultSpawner: Spawner = (command, args, env) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: 'inherit', env });
    child.on('error', (error) => {
      reject(error);
    });
    child.on('exit', (code) => {
      resolve(code ?? 0);
    });
  });

const resolverKey = (key: unknown): string => (typeof key === 'string' ? key : DEFAULT_KEY);

export const runRun = async (options: RunOptions): Promise<number> => {
  const config = await loadConfig(options.cwd);
  const result = await provisionCurrent({ cwd: options.cwd, reporter: options.reporter, load: options.load });
  const env: NodeJS.ProcessEnv = { ...process.env, [resolverKey(config.resolver.key)]: result.connection };
  const spawner = options.spawn ?? defaultSpawner;
  return spawner(options.command, options.args, env);
};

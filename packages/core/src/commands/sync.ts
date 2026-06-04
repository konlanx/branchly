import { type AdapterLoader } from '../runtime/plugins';
import { narrateResult, type Reporter } from '../runtime/reporter';
import { provisionCurrent } from '../runtime/run';

export interface SyncOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly load?: AdapterLoader;
}

export const runSync = async (options: SyncOptions): Promise<void> => {
  options.reporter.intro('branchly sync');
  const result = await provisionCurrent({ cwd: options.cwd, reporter: options.reporter, load: options.load });
  narrateResult(options.reporter, result.ref, result.key, result.outcome);
};

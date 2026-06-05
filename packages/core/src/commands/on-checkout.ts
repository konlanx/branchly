import { runSweep } from './sweep';
import { type AdapterLoader } from '../runtime/plugins';
import { narrateResult, type Reporter } from '../runtime/reporter';
import { provisionCurrent } from '../runtime/run';

export const shouldProvisionOnCheckout = (previousHead: string, newHead: string, flag: string): boolean =>
  flag === '1' && previousHead !== newHead;

export interface OnCheckoutOptions {
  readonly cwd: string;
  readonly reporter: Reporter;
  readonly args: readonly string[];
  readonly load?: AdapterLoader;
}

export const runOnCheckout = async (options: OnCheckoutOptions): Promise<void> => {
  const [previousHead = '', newHead = '', flag = ''] = options.args;
  if (!shouldProvisionOnCheckout(previousHead, newHead, flag)) {
    return;
  }
  options.reporter.intro('branchly');
  const result = await provisionCurrent({ cwd: options.cwd, reporter: options.reporter, load: options.load });
  await runSweep({ cwd: options.cwd, reporter: options.reporter, load: options.load });
  narrateResult(options.reporter, result.ref, result.key, result.outcome);
};

import { runSync } from './sync';
import { type AdapterLoader } from '../runtime/plugins';
import type { Reporter } from '../runtime/reporter';

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
  await runSync({ cwd: options.cwd, reporter: options.reporter, load: options.load });
};

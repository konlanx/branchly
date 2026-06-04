import type { Capabilities } from '../interfaces';

export type ProvisionStrategyLabel = 'clone-from-ancestor' | 'clone-from-snapshot' | 'create-only';

export interface ProvisionStrategy {
  readonly clone: boolean;
  readonly snapshot: boolean;
  readonly label: ProvisionStrategyLabel;
}

export const negotiateStrategy = (capabilities: Capabilities): ProvisionStrategy => {
  if (capabilities.instantClone && capabilities.snapshot) {
    return { clone: true, snapshot: true, label: 'clone-from-snapshot' };
  }
  if (capabilities.instantClone) {
    return { clone: true, snapshot: false, label: 'clone-from-ancestor' };
  }
  return { clone: false, snapshot: false, label: 'create-only' };
};

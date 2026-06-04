import { describe, expect, it } from 'vitest';

import { shouldProvisionOnCheckout } from './on-checkout';

describe('shouldProvisionOnCheckout', () => {
  it('provisions on a branch checkout that changes HEAD', () => {
    expect(shouldProvisionOnCheckout('aaa', 'bbb', '1')).toBe(true);
  });

  it('skips file checkouts', () => {
    expect(shouldProvisionOnCheckout('aaa', 'bbb', '0')).toBe(false);
  });

  it('skips same-branch no-op checkouts', () => {
    expect(shouldProvisionOnCheckout('aaa', 'aaa', '1')).toBe(false);
  });
});

import { intro, log, outro } from '@clack/prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createReporter, narrateEvent, narrateResult } from './reporter';

vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  log: { info: vi.fn(), step: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('createReporter', () => {
  it('emits intro, steps, and success when not quiet', () => {
    const reporter = createReporter({ quiet: false });
    reporter.intro('branchly sync');
    reporter.step('working');
    reporter.success('done');
    expect(vi.mocked(intro)).toHaveBeenCalledWith('branchly sync');
    expect(vi.mocked(log.step)).toHaveBeenCalledWith('working');
    expect(vi.mocked(log.success)).toHaveBeenCalledWith('done');
  });

  it('suppresses everything but errors when quiet', () => {
    const reporter = createReporter({ quiet: true });
    reporter.intro('branchly sync');
    reporter.info('hush');
    reporter.error('boom');
    expect(vi.mocked(intro)).not.toHaveBeenCalled();
    expect(vi.mocked(log.info)).not.toHaveBeenCalled();
    expect(vi.mocked(log.error)).toHaveBeenCalledWith('boom');
  });
});

describe('narrate', () => {
  it('narrates a provision event as a step', () => {
    narrateEvent(createReporter({ quiet: false }), { kind: 'seeding' });
    expect(vi.mocked(log.step)).toHaveBeenCalledWith(expect.stringContaining('seed'));
  });

  it('closes a fast path with an already-in-sync outro', () => {
    narrateResult(createReporter({ quiet: false }), 'main', 'main__fp', 'fast-path');
    expect(vi.mocked(outro)).toHaveBeenCalledWith(expect.stringContaining('already in sync'));
  });

  it('closes a fresh provision with a celebratory outro', () => {
    narrateResult(createReporter({ quiet: false }), 'feature/x', 'feature_x__fp', 'created');
    expect(vi.mocked(outro)).toHaveBeenCalledWith(expect.stringContaining('ready to go'));
  });
});

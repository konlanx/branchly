import { describe, expect, it } from 'vitest';

import { ensureIgnored } from './gitignore';

describe('ensureIgnored', () => {
  it('appends missing patterns', () => {
    expect(ensureIgnored('node_modules\n', ['.branchly/', '.env'])).toBe('node_modules\n.branchly/\n.env\n');
  });

  it('is idempotent when every pattern is already present', () => {
    const content = 'node_modules\n.branchly/\n.env\n';
    expect(ensureIgnored(content, ['.branchly/', '.env'])).toBe(content);
  });

  it('inserts a trailing newline before appending when one is missing', () => {
    expect(ensureIgnored('node_modules', ['.env'])).toBe('node_modules\n.env\n');
  });

  it('handles empty content', () => {
    expect(ensureIgnored('', ['.env'])).toBe('.env\n');
  });
});

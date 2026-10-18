import { describe, expect, it } from 'vitest';
import { formatDepth, formatNumber, formatPercent } from '../lib/format';

describe('format helpers', () => {
  it('uses grouped digits', () => {
    expect(formatNumber(131535897)).toBe('131,535,897');
    expect(formatNumber(100360)).toBe('100,360');
    expect(formatNumber(null)).toBe('—');
  });

  it('formats depth and percentages', () => {
    expect(formatDepth(1_000_000_000)).toBe('10 亿位');
    expect(formatPercent(500_000_000, 1_000_000_000)).toBe('50.00%');
    expect(formatPercent(null, 1_000_000_000)).toBe('—');
  });
});

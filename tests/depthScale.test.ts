import { describe, expect, it } from 'vitest';
import { depthTicks, logDepthPercent } from '../src/lib/depthScale';

describe('logDepthPercent', () => {
  it('把 1 位和最大深度分别放在两端', () => {
    expect(logDepthPercent(1, 1_000_000_000)).toBe(0);
    expect(logDepthPercent(1_000_000_000, 1_000_000_000)).toBe(100);
  });

  it('按对数比例分布', () => {
    expect(logDepthPercent(1_000, 1_000_000_000)).toBeCloseTo(33.333, 2);
    expect(logDepthPercent(1_000_000, 1_000_000_000)).toBeCloseTo(66.667, 2);
    expect(logDepthPercent(1_000_000_000, 1_000_000_000)).toBe(100);
  });

  it('超出范围或非法值 clamp 到 0–100', () => {
    expect(logDepthPercent(0, 1_000_000)).toBe(0);
    expect(logDepthPercent(-5, 1_000_000)).toBe(0);
    expect(logDepthPercent(2_000_000, 1_000_000)).toBe(100);
    expect(logDepthPercent(Number.NaN, 1_000_000)).toBe(0);
    expect(logDepthPercent(123, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('深度不足两位时退回 0', () => {
    expect(logDepthPercent(1, 1)).toBe(0);
    expect(logDepthPercent(1, 0)).toBe(0);
  });
});

describe('depthTicks', () => {
  it('十亿深度给 1 / 1,000 / 100 万 / 10 亿 四站', () => {
    const ticks = depthTicks(1_000_000_000);
    expect(ticks.map((tick) => tick.value)).toEqual([1, 1_000, 1_000_000, 1_000_000_000]);
    expect(ticks.map((tick) => tick.label)).toEqual(['1 位', '1,000 位', '100 万位', '10 亿位']);
    expect(ticks[0].percent).toBe(0);
    expect(ticks[ticks.length - 1].percent).toBe(100);
  });

  it('非整十亿深度也会把末端补上', () => {
    const ticks = depthTicks(10_000_000);
    expect(ticks[ticks.length - 1].value).toBe(10_000_000);
    expect(ticks[ticks.length - 1].percent).toBe(100);
    expect(new Set(ticks.map((tick) => tick.value)).size).toBe(ticks.length);
  });

  it('深度不合法时只保留起点', () => {
    expect(depthTicks(0)).toHaveLength(1);
    expect(depthTicks(1)).toHaveLength(1);
    expect(depthTicks(Number.NaN)[0].percent).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  clamp01,
  countUpValue,
  easeOutCubic,
  revealDelay,
  scrollThroughProgress,
  stagger,
} from '../src/lib/motion';
import { headline, heroNumber } from '../src/lib/headline';
import type { NeedleState, ScanSnapshot } from '../src/lib/searchEngine';

function needle(overrides: Partial<NeedleState> = {}): NeedleState {
  return {
    id: '20261015',
    digits: '20261015',
    length: 8,
    firstHit: null,
    firstHitConfirmed: false,
    occurrences: 0,
    occurrencesConfirmed: 0,
    status: 'searching',
    ...overrides,
  };
}

function snapshot(overrides: Partial<ScanSnapshot> = {}): ScanSnapshot {
  return {
    phase: 'searching',
    scannedDigits: 0,
    checkedDigits: 0,
    targetDigits: 10_000_000,
    availableDigits: 1_000_000_000,
    bytesFetched: 0,
    chunksDone: 0,
    elapsedMs: 0,
    etaMs: null,
    gaps: [],
    needles: [],
    ...overrides,
  };
}

describe('motion 纯函数', () => {
  it('clamp01 夹到 [0, 1]，并把非有限值当作 0', () => {
    expect(clamp01(-5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.42)).toBe(0.42);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(9)).toBe(1);
    expect(clamp01(Number.NaN)).toBe(0);
    expect(clamp01(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('easeOutCubic 两端准确、中段缓出', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 6);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.25);
    expect(easeOutCubic(0.25)).toBeCloseTo(0.578125, 6);
    expect(easeOutCubic(0.75)).toBeLessThan(1);
    expect(easeOutCubic(0.3)).toBeGreaterThan(easeOutCubic(0.2));
  });

  it('stagger / revealDelay 按序号线性错开', () => {
    expect(stagger(0)).toBe(0);
    expect(stagger(-3)).toBe(0);
    expect(stagger(1)).toBe(90);
    expect(stagger(4, 120)).toBe(480);
    expect(stagger(2.9, 100)).toBe(200);
    expect(revealDelay(3)).toBe(270);
    expect(revealDelay(2, 50, 200)).toBe(300);
    expect(revealDelay(0, 90, 120)).toBe(120);
  });

  it('countUpValue 从 0 走到目标值', () => {
    expect(countUpValue(13_634_723, 0)).toBe(0);
    expect(countUpValue(13_634_723, 1)).toBe(13_634_723);
    expect(countUpValue(13_634_723, 0.5)).toBe(Math.round(13_634_723 * 0.875));
    expect(countUpValue(13_634_723, -1)).toBe(0);
    expect(countUpValue(13_634_723, 4)).toBe(13_634_723);
    expect(countUpValue(Number.NaN, 0.5)).toBe(0);
    expect(countUpValue(8, 0.2)).toBeGreaterThanOrEqual(0);
    expect(countUpValue(8, 0.2)).toBeLessThanOrEqual(8);
  });

  it('scrollThroughProgress 描述元素滚过视口的比例', () => {
    expect(scrollThroughProgress(0, 800)).toBe(0);
    expect(scrollThroughProgress(-400, 800)).toBe(0.5);
    expect(scrollThroughProgress(-800, 800)).toBe(1);
    expect(scrollThroughProgress(-2000, 800)).toBe(1);
    expect(scrollThroughProgress(120, 800)).toBe(0);
    expect(scrollThroughProgress(-100, 0)).toBe(0);
    expect(scrollThroughProgress(Number.NaN, 800)).toBe(0);
  });
});

describe('headline 结论文案', () => {
  it('还没有状态时是准备中', () => {
    expect(headline('20261015', undefined, null)).toEqual({ text: '准备中…', tone: 'pending' });
  });

  it('确认命中后给出位次结论', () => {
    const result = headline(
      '20261015',
      needle({ firstHit: 13_634_723, firstHitConfirmed: true, status: 'found' }),
      snapshot({ phase: 'done' }),
    );
    expect(result.tone).toBe('found');
    expect(result.text).toBe('20261015 首次出现在 π 的小数点后第 13,634,723 位');
  });

  it('命中但前面还没扫完时只说疑似', () => {
    const result = headline('20261015', needle({ firstHit: 2_780 }), snapshot());
    expect(result.tone).toBe('tentative');
    expect(result.text).toContain('疑似第 2,780 位');
    expect(result.text).toContain('暂定');
  });

  it('有缺口就说明结论不完整，而不是「没有出现」', () => {
    const result = headline(
      '10142026',
      needle({ digits: '10142026', length: 8, status: 'partial' }),
      snapshot({ phase: 'stopped', scannedDigits: 500_000, gaps: [[120_000, 160_000]] }),
    );
    expect(result.tone).toBe('partial');
    expect(result.text).toContain('已扫描范围内没有出现 10142026');
    expect(result.text).toContain('缺口');
  });

  it('扫完整个范围才说没有出现', () => {
    const result = headline(
      '10142026',
      needle({ digits: '10142026', length: 8, status: 'not-found' }),
      snapshot({ phase: 'done', targetDigits: 10_000_000, scannedDigits: 10_000_000 }),
    );
    expect(result.tone).toBe('notfound');
    expect(result.text).toBe('10142026 没有出现在前 1000 万 位小数里');
  });

  it('搜索中报出已扫描位数', () => {
    const result = headline('20261015', needle(), snapshot({ scannedDigits: 417_576_887 }));
    expect(result.tone).toBe('searching');
    expect(result.text).toBe('正在搜索 20261015（已扫描 4.18 亿 位）');
  });
});

describe('heroNumber 首屏巨型数字', () => {
  it('确认命中时显示位次', () => {
    const hero = heroNumber(
      needle({ firstHit: 13_634_723, firstHitConfirmed: true, status: 'found' }),
      snapshot({ phase: 'done' }),
    );
    expect(hero).toEqual({ value: 13_634_723, kind: 'position', confirmed: true, tone: 'found' });
  });

  it('未确认的命中显示位次但标记为暂定', () => {
    const hero = heroNumber(needle({ firstHit: 7_766 }), snapshot());
    expect(hero.value).toBe(7_766);
    expect(hero.kind).toBe('position');
    expect(hero.confirmed).toBe(false);
    expect(hero.tone).toBe('tentative');
  });

  it('还没命中时显示实时扫描位数，避免首屏空着', () => {
    const hero = heroNumber(needle(), snapshot({ scannedDigits: 512_000 }));
    expect(hero.value).toBe(512_000);
    expect(hero.kind).toBe('scanned');
    expect(hero.tone).toBe('searching');
  });

  it('停止扫描且未命中时仍然是扫描位数，但语气变成 partial', () => {
    const hero = heroNumber(needle({ status: 'partial' }), snapshot({ phase: 'stopped', scannedDigits: 9_000 }));
    expect(hero.value).toBe(9_000);
    expect(hero.kind).toBe('scanned');
    expect(hero.tone).toBe('partial');
  });

  it('连快照都没有时没有数字可显示', () => {
    expect(heroNumber(undefined, null)).toEqual({
      value: null,
      kind: 'none',
      confirmed: false,
      tone: 'pending',
    });
    expect(heroNumber(needle(), null).kind).toBe('none');
  });
});

import { describe, expect, it } from 'vitest';
import { pickDisplayNeedle, type PresentableNeedle } from '../src/lib/present';

const ORDER = ['20261015', '1015', '1510', '261015', '10152026', '15102026'];

/** 只给「命中了哪几个写法」的速写：位置 0 表示还没命中 */
function states(hits: Record<string, number | null>, confirmed: Record<string, boolean> = {}): PresentableNeedle[] {
  return ORDER.map((digits) => {
    const hit = hits[digits] ?? null;
    return {
      digits,
      firstHit: hit,
      firstHitConfirmed: hit !== null && (confirmed[digits] ?? true),
    };
  });
}

describe('首屏展示哪一条写法', () => {
  it('主写法已确认就直接用它，哪怕别的写法位次更靠前', () => {
    const picked = pickDisplayNeedle(states({ 20261015: 500, 1015: 30 }), '20261015');
    expect(picked).toMatchObject({ digits: '20261015', position: 500, tentative: false });
  });

  it('主写法还只是暂定，就换成「已确认写法里位次最靠前的」', () => {
    const picked = pickDisplayNeedle(states({ 20261015: 500, 1015: 30, 1510: 9, 261015: 700 }, { 20261015: false }), '20261015');
    expect(picked).toMatchObject({ digits: '1510', position: 9, tentative: false });
  });

  it('多个已确认命中时取位次最小的，位次相同取搜索顺序靠前的', () => {
    expect(pickDisplayNeedle(states({ 1015: 30, 1510: 9, 261015: 9 }), '20261015')).toMatchObject({ digits: '1510' });
  });

  it('一个确认的都没有时，退回主写法的暂定位次', () => {
    const picked = pickDisplayNeedle(
      states({ 20261015: 500, 1015: 30 }, { 20261015: false, 1015: false }),
      '20261015',
    );
    expect(picked).toMatchObject({ digits: '20261015', position: 500, tentative: true });
  });

  it('主写法没命中时，取顺序里第一个有命中的写法（哪怕是暂定）', () => {
    const picked = pickDisplayNeedle(states({ 1015: 30 }, { 1015: false }), '20261015');
    expect(picked).toMatchObject({ digits: '1015', position: 30, tentative: true });
  });

  it('一个没命中就返回 null', () => {
    expect(pickDisplayNeedle(states({}), '20261015')).toBeNull();
    expect(pickDisplayNeedle([], '20261015')).toBeNull();
  });

  it('标签查不到就回退成数字串本身，origin / knownThrough 原样带出', () => {
    const withTable: PresentableNeedle[] = [
      { digits: '20261015', firstHit: null, firstHitConfirmed: false },
      {
        digits: '1015',
        firstHit: 2780,
        firstHitConfirmed: true,
        origin: 'table',
        knownThrough: 1_000_000_000,
      },
    ];
    const picked = pickDisplayNeedle(withTable, '20261015', (digits) => (digits === '1015' ? 'MMDD' : digits));
    expect(picked).toEqual({
      digits: '1015',
      position: 2780,
      tentative: false,
      label: 'MMDD',
      origin: 'table',
      knownThrough: 1_000_000_000,
    });
    expect(pickDisplayNeedle(states({ 1510: 12 }), '20261015')?.label).toBe('1510');
  });
});

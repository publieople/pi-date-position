import { describe, expect, it } from 'vitest';
import { PAGE_SLACK, accumulateWheel, pageTarget, sectionIndexAt, normalizeSections, type PagingSection, type WheelGesture } from '../src/lib/paging';

const VIEWPORT = 800;
const MAX_SCROLL = 4000;

/** hero 一屏，forms 比一屏高，digits 一屏，多给一段用于测试夹取。 */
const SECTIONS: PagingSection[] = [
  { id: 'hero', top: 0, height: 800 },
  { id: 'forms', top: 800, height: 1200 },
  { id: 'digits', top: 2000, height: 800 },
];

describe('归一化与定位', () => {
  it('乱序输入按文档顺序排好', () => {
    const shuffled = [SECTIONS[2], SECTIONS[0], SECTIONS[1]];
    expect(normalizeSections(shuffled).map((s) => s.id)).toEqual(['hero', 'forms', 'digits']);
  });

  it('段落顶部算作该段，段内位置也归该段', () => {
    expect(sectionIndexAt(SECTIONS, 0)).toBe(0);
    expect(sectionIndexAt(SECTIONS, 799)).toBe(0);
    expect(sectionIndexAt(SECTIONS, 800)).toBe(1);
    expect(sectionIndexAt(SECTIONS, 1900)).toBe(1);
    expect(sectionIndexAt(SECTIONS, 2000)).toBe(2);
  });

  it('还没滚到第一段时归第一段；空列表返回 -1', () => {
    expect(sectionIndexAt(SECTIONS, -50)).toBe(0);
    expect(sectionIndexAt([], 0)).toBe(-1);
  });
});

describe('向下翻页', () => {
  it('一屏高的段落：任何向下滚动都吸到下一段开头', () => {
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 0, 1)).toBe(800);
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 12, 1)).toBe(800);
  });

  it('比一屏高的段落：没滚到底就交回原生滚动', () => {
    // forms 的底边对齐视口底部是 scrollY = 800 + 1200 - 800 = 1200
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 801, 1)).toBeNull();
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 1100, 1)).toBeNull();
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 1200 - PAGE_SLACK - 1, 1)).toBeNull();
  });

  it('滚到段落底部后翻到下一段', () => {
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 1200 - PAGE_SLACK, 1)).toBe(2000);
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 1300, 1)).toBe(2000);
  });

  it('最后一段到底后不再翻，交回原生滚动', () => {
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, MAX_SCROLL, 1)).toBeNull();
  });

  it('段落底部超出文档上限时按上限夹取', () => {
    const shorter = [
      { id: 'a', top: 0, height: 800 },
      { id: 'b', top: 800, height: 5000 },
    ];
    expect(pageTarget(shorter, VIEWPORT, 1000, 0, 1)).toBe(800);
    expect(pageTarget(shorter, VIEWPORT, 700, 0, 1)).toBe(700);
  });
});

describe('向上翻页', () => {
  it('段首（含容差）向上吸到上一段开头', () => {
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 2000, -1)).toBe(800);
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 2000 + PAGE_SLACK, -1)).toBe(800);
  });

  it('比一屏高的段落内向上先交回原生滚动', () => {
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 800 + PAGE_SLACK + 1, -1)).toBeNull();
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 1800, -1)).toBeNull();
  });

  it('一屏高段落里向上直接翻页（没有可再往下看的内容）', () => {
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 2000 + PAGE_SLACK + 1, -1)).toBe(800);
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 2600, -1)).toBe(800);
  });

  it('第一段向上回到 0', () => {
    expect(pageTarget(SECTIONS, VIEWPORT, MAX_SCROLL, 0, -1)).toBe(0);
  });
});

describe('退化输入', () => {
  it('空章节表 / 零视口 / 无法滚动时都不干预', () => {
    expect(pageTarget([], VIEWPORT, MAX_SCROLL, 0, 1)).toBeNull();
    expect(pageTarget(SECTIONS, 0, MAX_SCROLL, 0, 1)).toBeNull();
    expect(pageTarget(SECTIONS, VIEWPORT, 0, 0, 1)).toBeNull();
  });
});
describe('滚轮手势累积（触控板 1–3px 的小事件不会被丢掉）', () => {
  it('鼠标滚轮一格的大 delta 一次就够', () => {
    const first = accumulateWheel(null, 100, 0);
    expect(first.triggered).toBe(true);
    expect(first.gesture.total).toBe(0);
  });

  it('触控板的小 delta 累积到阈值才翻页（4+4+4 = 12）', () => {
    let gesture: WheelGesture | null = null;
    let fired = 0;
    for (const now of [0, 16, 32]) {
      const step = accumulateWheel(gesture, 4, now);
      gesture = step.gesture;
      if (step.triggered) fired += 1;
    }
    expect(fired).toBe(1);
  });

  it('超过时间窗就重新计数', () => {
    const first = accumulateWheel(null, 8, 0);
    expect(first.triggered).toBe(false);
    const second = accumulateWheel(first.gesture, 8, 500);
    expect(second.triggered).toBe(false);
    expect(second.gesture.total).toBe(8);
  });

  it('细小事件连续到来时，即使手势超过一个窗口时长也继续累积', () => {
    let gesture: WheelGesture | null = null;
    let fired = 0;
    // 每 40ms 一条 2px：跨度 200ms（远大于 90ms 窗口），但每条间隔都在窗口内
    for (const now of [0, 40, 80, 120, 160, 200]) {
      const step = accumulateWheel(gesture, 2, now);
      gesture = step.gesture;
      if (step.triggered) fired += 1;
    }
    expect(fired).toBe(1);
  });

  it('方向翻转重置累积', () => {
    const up = accumulateWheel(null, -8, 0);
    const down = accumulateWheel(up.gesture, 8, 16);
    expect(down.triggered).toBe(false);
    expect(down.gesture.direction).toBe(1);
    expect(down.gesture.total).toBe(8);
  });

  it('触发后清零，同一手势不会连翻', () => {
    const big = accumulateWheel(null, 40, 0);
    expect(big.triggered).toBe(true);
    expect(accumulateWheel(big.gesture, 5, 16).triggered).toBe(false);
  });
});


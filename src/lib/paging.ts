/**
 * 整页滚动吸附的纯计算部分：由「章节几何 + 当前滚动位置 + 滚动方向」决定这一次滚轮
 * 该翻滚到哪一段的开头，还是交回浏览器原生滚动。
 *
 * 为什么不直接用 CSS `scroll-snap-type: y mandatory`：本站有几段比一屏高
 * （六种写法 6 张卡、引擎控制台），mandatory 会在读到半截时把人弹回段首。
 */

export interface PagingSection {
  id: string;
  /** 文档坐标下的段落顶部 */
  top: number;
  height: number;
}

/** 判定「已经滚到段落底部」的像素容差。 */
export const PAGE_SLACK = 6;

/** 段落按文档顺序排好；调用方给乱序也安全。 */
export function normalizeSections(sections: readonly PagingSection[]): PagingSection[] {
  return [...sections].sort((a, b) => a.top - b.top);
}

/** 当前位置属于哪一段：取 top <= scrollY 的最后一段；全都还在下面时取第一段。 */
export function sectionIndexAt(sections: readonly PagingSection[], scrollY: number): number {
  if (sections.length === 0) return -1;
  let index = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].top <= scrollY) index = i;
    else break;
  }
  return index;
}

/**
 * 这一次滚轮该滚到哪：
 * - `null` = 交回浏览器原生滚动（这一段比一屏高、还没滚到底；或已经到头）。
 * - 数字 = 该翻滚到的 scrollY（目标段落顶部），吸附效果就来自这里。
 */
export function pageTarget(
  sections: readonly PagingSection[],
  viewportHeight: number,
  maxScroll: number,
  scrollY: number,
  direction: 1 | -1,
  slack = PAGE_SLACK,
): number | null {
  if (viewportHeight <= 0 || maxScroll <= 0) return null;
  const list = normalizeSections(sections);
  const index = sectionIndexAt(list, scrollY);
  if (index < 0) return null;
  const current = list[index];

  if (direction === 1) {
    // 段落底部对齐视口底部的那一屏，就是「滚到底了」
    const boundary = current.top + current.height - viewportHeight;
    if (scrollY + slack < boundary) return null;
    const next = list[index + 1];
    if (!next) return null;
    return Math.min(next.top, maxScroll);
  }

  // 一屏能装下的段落没有「往下看」的余地，向上也直接翻页；比一屏高的先滚回段首
  const fitsViewport = current.height <= viewportHeight + slack;
  if (!fitsViewport && scrollY > current.top + slack) return null;
  const prev = list[index - 1];
  return prev ? Math.max(0, Math.min(prev.top, maxScroll)) : 0;
}

/** 触控板惯性滚动每帧只发 1–3px 的 deltaY，所以按时间窗累积后再判定。 */
export const WHEEL_WINDOW_MS = 90;
/** 一个时间窗内累积到这么多像素才算「真的想翻一页」（鼠标滚轮一格通常是 100+）。 */
export const WHEEL_MIN_DELTA = 12;

export interface WheelGesture {
  direction: 1 | -1;
  /** 本次手势已累积的像素 */
  total: number;
  /** 最近一次事件的时刻（毫秒） */
  last: number;
}

/**
 * 累积滚轮 delta：方向翻转、或距**上一条**事件超过 `windowMs`（一次滑动停了）就重新起一次；
 * 累积够 `threshold` 就返回 `triggered` 并把计数清零（一次手势只翻一页）。
 *
 * 用「距上一条事件」而不是「距手势起点」，是为了让细碎的触控板事件真正累加：
 * 每帧只有 1–3px 时，攒够 12px 往往要十几条事件、耗时可能超过一个窗口。
 */
export function accumulateWheel(
  gesture: WheelGesture | null,
  deltaY: number,
  now: number,
  windowMs = WHEEL_WINDOW_MS,
  threshold = WHEEL_MIN_DELTA,
): { gesture: WheelGesture; triggered: boolean } {
  const direction: 1 | -1 = deltaY >= 0 ? 1 : -1;
  const stale = gesture === null || gesture.direction !== direction || now - gesture.last > windowMs;
  const total = (stale ? 0 : gesture.total) + Math.abs(deltaY);
  if (total < threshold) return { gesture: { direction, total, last: now }, triggered: false };
  return { gesture: { direction, total: 0, last: now }, triggered: true };
}

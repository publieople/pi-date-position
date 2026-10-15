// 滚动动效的纯函数部分：与 DOM 无关，便于单测。
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

/** 第 index 个元素相对首个元素的入场延迟（毫秒）。 */
export function stagger(index: number, step = 90): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.floor(index) * step;
}

export function revealDelay(index: number, step = 90, base = 0): number {
  return base + stagger(index, step);
}

/** progress 0→1 时数值 0→target（缓出）。 */
export function countUpValue(target: number, progress: number): number {
  if (!Number.isFinite(target)) return 0;
  return Math.round(target * easeOutCubic(progress));
}

/** 元素顶部越过视口顶部的比例：0 = 正好贴在视口顶部，1 = 整块已滚过。 */
export function scrollThroughProgress(rectTop: number, rectHeight: number): number {
  if (!Number.isFinite(rectTop) || !Number.isFinite(rectHeight) || rectHeight <= 0) return 0;
  return clamp01(-rectTop / rectHeight);
}

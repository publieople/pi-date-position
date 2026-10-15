import { useEffect } from 'react';
import { pageTarget, type PagingSection } from '../lib/paging';

/** 一次翻页动画期间吞掉同一手势剩下的滚轮事件（毫秒）。 */
const LOCK_MS = 700;
/** 小于这个量级的 deltaY 当抖动丢掉。 */
const MIN_DELTA = 4;

/** 光标下还有能继续滚的容器时不要抢滚动（例如将来的代码块）。 */
function scrollableAncestor(target: EventTarget | null, direction: 1 | -1): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== document.body && node !== document.documentElement) {
    const style = window.getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
      const room = direction === 1 ? node.scrollHeight - node.clientHeight - node.scrollTop : node.scrollTop;
      if (room > 1) return true;
    }
    node = node.parentElement;
  }
  return false;
}

/** 现场量章节几何（6 段，开销可忽略；量完即用，不缓存，避免动画期间位置过期）。 */
export function measureSections(ids: readonly string[]): PagingSection[] {
  const out: PagingSection[] = [];
  for (const id of ids) {
    const node = document.getElementById(id);
    if (!node) continue;
    const rect = node.getBoundingClientRect();
    out.push({ id, top: Math.round(rect.top + window.scrollY), height: Math.round(rect.height) });
  }
  return out;
}

/**
 * 整页滚动吸附：滚轮一步落在章节边界上时，直接翻一整段；段落本身比一屏高时，
 * 先让浏览器原生滚到底，再翻下一页。触屏、键盘、拖动滚动条都不拦。
 */
export function useSectionPaging(ids: readonly string[], enabled = true) {
  const key = ids.join(',');

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const idList = key ? key.split(',') : [];
    let lockUntil = 0;

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || Math.abs(event.deltaY) < MIN_DELTA) return;
      const now = Date.now();
      if (now < lockUntil) {
        event.preventDefault();
        return;
      }
      const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1;
      if (scrollableAncestor(event.target, direction)) return;

      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
      const target = pageTarget(measureSections(idList), viewportHeight, maxScroll, window.scrollY, direction);
      if (target === null || Math.abs(target - window.scrollY) < 1) return;

      event.preventDefault();
      lockUntil = now + LOCK_MS;
      window.scrollTo({ top: target, behavior: 'smooth' });
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, [key, enabled]);
}

import { useEffect } from 'react';
import { accumulateWheel, pageTarget, pagingIntentForKey, type PagingSection, type WheelGesture } from '../lib/paging';

/** 一次翻页动画期间吞掉同一手势剩下的滚轮事件（毫秒）。 */
const LOCK_MS = 700;

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

/** 输入框 / 文本域 / 可编辑区域里的按键不抢（Home、End 在日期框里是光标移动）。 */
function isEditable(target: EventTarget | null): boolean {
  const node = target instanceof HTMLElement ? target : null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  return /^(input|textarea|select)$/i.test(node.tagName);
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
    let gesture: WheelGesture | null = null;

    const onWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.deltaY === 0) return;
      const now = Date.now();
      if (now < lockUntil) {
        // 翻页动画期间的惯性滚动属于同一手势：一并吞掉，累积也作废
        event.preventDefault();
        gesture = null;
        return;
      }
      const direction: 1 | -1 = event.deltaY > 0 ? 1 : -1;
      if (scrollableAncestor(event.target, direction)) return;

      // 触控板一次滑动会发几十条 1–3px 的事件，单条判断会漏；累积到阈值才算一次翻页
      const accumulated = accumulateWheel(gesture, event.deltaY, now);
      gesture = accumulated.gesture;
      if (!accumulated.triggered) return;

      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
      const target = pageTarget(measureSections(idList), viewportHeight, maxScroll, window.scrollY, direction);
      if (target === null || Math.abs(target - window.scrollY) < 1) return;

      event.preventDefault();
      lockUntil = now + LOCK_MS;
      window.scrollTo({ top: target, behavior: 'smooth' });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditable(event.target)) return;
      const intent = pagingIntentForKey(event);
      if (!intent) return;
      const viewportHeight = window.innerHeight;
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - viewportHeight);
      if (intent.kind === 'edge') {
        const edge = intent.edge === 'start' ? 0 : maxScroll;
        if (Math.abs(edge - window.scrollY) < 1) return;
        event.preventDefault();
        window.scrollTo({ top: edge, behavior: 'smooth' });
        return;
      }
      const target = pageTarget(measureSections(idList), viewportHeight, maxScroll, window.scrollY, intent.direction);
      if (target === null || Math.abs(target - window.scrollY) < 1) return;
      event.preventDefault();
      lockUntil = Date.now() + LOCK_MS;
      window.scrollTo({ top: target, behavior: 'smooth' });
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [key, enabled]);
}

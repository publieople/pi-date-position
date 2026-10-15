import { useEffect, useRef, useState } from 'react';
import { scrollThroughProgress } from '../lib/motion';

/**
 * 元素在页面里「滚过去」的比例：0 = 顶部刚贴住视口顶部，1 = 整块已滚过一屏。
 * 只读 getBoundingClientRect，滚动回调用 rAF 节流，且只更新 state（无副作用）。
 */
export function useScrollProgress<T extends HTMLElement = HTMLElement>(enabled = true) {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setProgress(0);
      return;
    }
    const node = ref.current;
    if (!node) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      setProgress(scrollThroughProgress(rect.top, rect.height));
    };
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [enabled]);

  return { ref, progress };
}

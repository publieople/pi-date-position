import { useEffect, useRef, useState } from 'react';
import { clamp01, easeOutCubic } from '../lib/motion';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** 数值滚动到位：从当前显示值缓动到 target；prefers-reduced-motion 或 duration<=0 时直接给终值。 */
export function useCountUp(target: number, options: { duration?: number; enabled?: boolean } = {}): number {
  const { duration = 900, enabled = true } = options;
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    if (!enabled || reduced || duration <= 0 || typeof window === 'undefined') {
      shownRef.current = target;
      setValue(target);
      return;
    }
    const from = shownRef.current;
    const delta = target - from;
    if (delta === 0) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = clamp01((now - start) / duration);
      const next = from + delta * easeOutCubic(t);
      shownRef.current = next;
      setValue(Math.round(next));
      if (t < 1) frame = window.requestAnimationFrame(tick);
      else shownRef.current = target;
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration, enabled, reduced]);

  return value;
}

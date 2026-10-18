import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(target: number | null, duration: number = 900): number | null {
  const [value, setValue] = useState<number | null>(target);
  const valueRef = useRef<number | null>(target);

  useEffect(() => {
    if (target === null) {
      valueRef.current = null;
      setValue(null);
      return;
    }
    if (prefersReducedMotion()) {
      valueRef.current = target;
      setValue(target);
      return;
    }
    const from = valueRef.current;
    if (from === target) {
      setValue(target);
      return;
    }
    const startValue = from === null ? 0 : from;
    const startTime = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(2, -10 * progress);
      const next = Math.round(startValue + (target - startValue) * eased);
      valueRef.current = next;
      setValue(next);
      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        valueRef.current = target;
        setValue(target);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

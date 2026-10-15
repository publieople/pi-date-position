import { useEffect, useRef, useState } from 'react';

export interface UseInViewOptions {
  once?: boolean;
  threshold?: number;
  rootMargin?: string;
}

/** 元素进入视口时返回 inView；StrictMode 双挂载安全（effect 内创建 / 销毁 observer）。 */
export function useInView<T extends HTMLElement = HTMLElement>(options: UseInViewOptions = {}) {
  const { once = true, threshold = 0.2, rootMargin = '0px 0px -8% 0px' } = options;
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [once, threshold, rootMargin]);

  return { ref, inView };
}

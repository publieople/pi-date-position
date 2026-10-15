import { useEffect, useState } from 'react';

/** 由章节 id 列表 + IntersectionObserver（窄条带）得出当前章节，供右侧导航轨高亮。 */
export function useActiveSection(ids: readonly string[], rootMargin = '-45% 0px -45% 0px'): string {
  const [active, setActive] = useState(() => ids[0] ?? '');
  const key = ids.join(',');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const list = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null);
    if (list.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActive(first.target.id);
      },
      { rootMargin },
    );
    for (const node of list) observer.observe(node);
    return () => observer.disconnect();
    // key 是 ids 内容的稳定指纹
  }, [key, rootMargin]);

  return active;
}

import { useEffect } from 'react';

/** 深链：#forms / #digits … 直接定位到章节（截图与分享用），不等入场动画。 */
export function useInitialHash(): void {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, '');
    if (!id) return;
    const node = document.getElementById(id);
    if (node) node.scrollIntoView({ block: 'start' });
  }, []);
}

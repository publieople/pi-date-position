import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

export interface NavItem {
  id: string;
  label: string;
}

export interface SiteNavProps {
  items: readonly NavItem[];
  active: string;
  /** 首屏（#hero）时隐藏，让首页只留一个主元素 */
  hidden: boolean;
}

/** 右侧固定导航轨：>=900px 才显示，点击平滑滚动（reduced-motion 时直接跳）。 */
export function SiteNav({ items, active, hidden }: SiteNavProps) {
  const reduced = usePrefersReducedMotion();
  return (
    <nav className={'rail' + (hidden ? '' : ' rail-visible')} aria-label="章节导航">
      {items.map((item) => (
        <a
          key={item.id}
          href={'#' + item.id}
          className={'rail-dot' + (item.id === active ? ' rail-dot-active' : '')}
          onClick={(event) => {
            event.preventDefault();
            const node = document.getElementById(item.id);
            if (!node) return;
            node.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
            window.history.replaceState(null, '', '#' + item.id);
          }}
        >
          <span className="rail-label">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

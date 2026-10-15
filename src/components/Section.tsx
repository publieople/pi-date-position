import type { CSSProperties, ReactNode } from 'react';
import { stagger } from '../lib/motion';
import { useInView } from '../hooks/useInView';

export interface RevealProps {
  children: ReactNode;
  /** 同级第几个元素，用来算 stagger 延迟（第 0 个无延迟） */
  index?: number;
  step?: number;
  baseDelay?: number;
  className?: string;
  style?: CSSProperties;
}

/** 进入视口时浮入的容器：自己持有 observer，只用 transform / opacity。 */
export function Reveal({
  children,
  index = 0,
  step = 90,
  baseDelay = 0,
  className,
  style,
}: RevealProps) {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  const delay = baseDelay + stagger(index, step);
  return (
    <div
      ref={ref}
      className={'reveal' + (inView ? ' is-in' : '') + (className ? ' ' + className : '')}
      style={{ transitionDelay: delay + 'ms', ...style }}
    >
      {children}
    </div>
  );
}

export interface SectionProps {
  /** 同时是深链锚点与导航轨的 id */
  id: string;
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** 章节外壳：小节标题一律走 Reveal 浮入，正文由调用方决定怎么排。 */
export function Section({ id, eyebrow, title, lead, children, className }: SectionProps) {
  return (
    <section id={id} className={'chapter' + (className ? ' ' + className : '')}>
      <Reveal className="chapter-head">
        {eyebrow ? <p className="chapter-eyebrow">{eyebrow}</p> : null}
        <h2 className="chapter-title">{title}</h2>
        {lead ? <p className="chapter-lead">{lead}</p> : null}
      </Reveal>
      <div className="chapter-body">{children}</div>
    </section>
  );
}

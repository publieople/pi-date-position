import { withUnit } from '../../lib/position';

export interface SiteFooterProps {
  scanned: number;
  target: number;
  sourceLabel: string;
}

export function SiteFooter({ scanned, target, sourceLabel }: SiteFooterProps) {
  return (
    <footer className="foot">
      <p className="foot-line">π 里的今天 · 位次口径：小数点后第 N 位（含整数位 3 则为第 N+1 位）</p>
      <p className="foot-line dim">
        已扫描 {withUnit(scanned, '位')} / 上限 {withUnit(target, '位')} · 数据源 {sourceLabel}
      </p>
      <p className="foot-line dim">
        命令行复核 <code>pnpm crosscheck</code> · 深搜预热 <code>pnpm prewarm</code> · 磁盘缓存 <code>.pi-cache/</code>
      </p>
    </footer>
  );
}

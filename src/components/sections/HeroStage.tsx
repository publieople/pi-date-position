import type { NeedleState, ScanSnapshot } from '../../lib/searchEngine';
import type { DigitSource } from '../../lib/digitSource';
import type { StripWriting } from '../DigitsStrip';
import { formatChineseDate, formatClock, formatCompact, formatThousands } from '../../lib/position';
import { headline, heroNumber, tableNote } from '../../lib/headline';
import { useCountUp } from '../../hooks/useCountUp';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useScrollProgress } from '../../hooks/useScrollProgress';

export interface HeroStageProps {
  now: Date;
  date: Date;
  isToday: boolean;
  primaryDigits: string;
  primaryState: NeedleState | undefined;
  snapshot: ScanSnapshot | null;
  source: DigitSource | null;
  /** 这一天里最早确认命中的写法；null = 还没有任何确认，改用实时扫描计数 */
  answer: (StripWriting & { position: number; origin?: 'scan' | 'table'; knownThrough?: number }) | null;
}

/** 首屏：整屏只有一个主元素 —— 这个日期在 π 里的位次（没找到时显示实时扫描位数）。 */
export function HeroStage({
  now,
  date,
  isToday,
  primaryDigits,
  primaryState,
  snapshot,
  source,
  answer,
}: HeroStageProps) {
  // 首屏优先回答「这一天在 π 里最早被确认的位次」；一个都没确认时才退回实时扫描计数。
  const fallback = heroNumber(primaryState, snapshot);
  const note = headline(primaryDigits, primaryState, snapshot);

  const kind: 'position' | 'scanned' | 'none' = answer ? 'position' : fallback.kind;
  const value = answer ? answer.position : fallback.value;
  const tone = answer ? (answer.tentative ? 'tentative' : 'found') : fallback.tone;
  const animated = useCountUp(value ?? 0, { enabled: kind === 'position' });
  const reduced = usePrefersReducedMotion();
  const { ref, progress } = useScrollProgress<HTMLElement>(!reduced);

  const shown = kind === 'position' ? animated : value;
  const display = shown === null ? '—' : formatThousands(shown);
  // 位次来自离线预计算表还是本次实时扫描，首屏就必须说清楚
  const fromTable = answer?.origin === 'table';
  const kindLabel = answer
    ? fromTable
      ? '已确认的位次 · 离线预计算表 · ' + answer.label + ' ' + answer.digits
      : (answer.tentative ? '暂定位次' : '已确认的位次') + ' · ' + answer.label + ' ' + answer.digits
    : kind === 'scanned'
      ? '已扫描的位数'
      : '等待数据源';

  const prefix = kind === 'position' ? '第' : '';
  const suffix = kind === 'none' ? '' : '位';

  // 巨型数字下面那行小字：位次结论用固定句式，否则直接复用 headline 的实时结论。
  const caption = answer ? answer.digits + ' 首次出现在 π 的小数点后' : note.text;

  // 「扫到 N 位就命中」只在首屏数字就是主写法（8 位）时成立，其它写法不能这么说；
  // 表答案不能套这句话，得说清它来自离线预计算、实时扫描只是再验证一遍。
  const noteText =
    answer && snapshot && answer.digits === primaryDigits
      ? fromTable
        ? tableNote(
            answer.knownThrough ?? 0,
            source && source.kind !== 'unavailable' ? source.maxDigits : 0,
            answer.position,
          )
        : '扫到 ' + formatCompact(snapshot.scannedDigits) + ' 位就命中，命中即停'
      : '';

  const parallax = reduced
    ? undefined
    : {
        transform: 'translateY(' + (-12 * progress).toFixed(2) + '%)',
        opacity: String(Math.max(0.1, 1 - progress * 1.15)),
      };

  return (
    <section id="hero" ref={ref} className={'stage tone-' + tone}>
      <div className="stage-glow" aria-hidden="true" />
      <div className="stage-inner" style={parallax}>
        <p className="stage-eyebrow">
          <span className={'badge' + (isToday ? ' badge-live' : '')}>{isToday ? '今天 · 实时' : '指定日期'}</span>
          <span className="stage-date">{formatChineseDate(date)}</span>
          <span className="stage-clock">{formatClock(now)}</span>
        </p>
        <p className="stage-kicker">{kindLabel}</p>
        <div className="stage-number">
          {prefix ? <span className="stage-number-prefix">{prefix}</span> : null}
          <span className="stage-number-value" aria-live="polite">
            {display}
          </span>
          {suffix ? <span className="stage-number-suffix">{suffix}</span> : null}
        </div>
        <p className="stage-caption">{caption}</p>
        {noteText ? <p className="stage-note">{noteText}</p> : null}
        {primaryState?.firstHitConfirmed ? null : source?.kind === 'server' ? (
          <a className="stage-cta" href="#engine">
            {primaryDigits} 这个 8 位完整写法还没锁定 —— 到「怎么找的」里深搜到 1 亿 / 10 亿位 →
          </a>
        ) : null}
        <a className="stage-scroll" href="#forms">
          向下滚动
          <span className="stage-arrow" aria-hidden="true">
            ↓
          </span>
        </a>
      </div>
    </section>
  );
}

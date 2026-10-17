import type { NeedleState, ScanSnapshot } from '../../lib/searchEngine';
import type { DigitSource } from '../../lib/digitSource';
import type { StripWriting } from '../DigitsStrip';
import { formatChineseDate, formatClock, formatThousands, withUnit } from '../../lib/position';
import { headline, heroNumber, swappedNote, tableNote } from '../../lib/headline';
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
  /** 本次实时扫描这一轮会覆盖到多深（目标深度）；0 = 数据源不可用 */
  scanReach: number;
  /** 离线答案表这一轮还没有结果：首屏先摆稳定的「读表中」态，不拿实时扫描的暂定值顶替 */
  tablePending: boolean;
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
  scanReach,
  tablePending,
  answer,
}: HeroStageProps) {
  // 首屏优先回答「这一天在 π 里最早被确认的位次」；一个都没确认时才退回实时扫描计数。
  const fallback = heroNumber(primaryState, snapshot);
  const note = headline(primaryDigits, primaryState, snapshot);

  // 表还在路上时先停在稳定的「读表中」态：几帧后表回来会把扫描计数整条换掉，
  // CTA 和备注也会跟着闪现再消失 —— 那正是首屏 CLS 的主要来源。
  const pending = tablePending && answer === null;

  const kind: 'position' | 'scanned' | 'none' = pending ? 'none' : answer ? 'position' : fallback.kind;
  const value = pending ? null : answer ? answer.position : fallback.value;
  const tone = pending ? 'pending' : answer ? (answer.tentative ? 'tentative' : 'found') : fallback.tone;
  const animated = useCountUp(value ?? 0, { enabled: !pending && kind === 'position' });
  const reduced = usePrefersReducedMotion();
  const { ref, progress } = useScrollProgress<HTMLElement>(!reduced);

  const shown = kind === 'position' ? animated : value;
  const display = value === null ? '—' : formatThousands(shown ?? 0);
  // 位次数字按最终文本宽度预留，逐帧计数时前缀/后缀不再被推着左右跑
  const numberWidth = value === null ? null : formatThousands(value).length + 'ch';
  // 位次来自离线答案表还是本次实时扫描，首屏就必须说清楚
  const fromTable = answer?.origin === 'table';
  const kindLabel = pending
    ? '正在读取离线答案表'
    : answer
      ? fromTable
        ? '已确认的位次 · 离线答案表 · ' + answer.label + ' ' + answer.digits
        : (answer.tentative ? '暂定位次' : '已确认的位次') + ' · ' + answer.label + ' ' + answer.digits
      : kind === 'scanned'
        ? '已扫描的位数'
        : kind === 'position'
          ? (fallback.confirmed ? '已确认的位次' : '暂定位次') + ' · ' + primaryDigits
          : '等待数据源';

  const prefix = kind === 'position' || pending ? '第' : '';
  const suffix = kind === 'none' && !pending ? '' : '位';

  // 巨型数字下面那行小字：位次结论用固定句式，否则直接复用 headline 的实时结论。
  const caption = pending
    ? '正在读 ' + primaryDigits + ' 这一天的离线答案表'
    : answer
      ? answer.digits + ' 首次出现在 π 的小数点后'
      : note.text;

  // 「扫到 N 位就命中」只在首屏数字就是主写法（8 位）时成立，其它写法不能这么说；
  // 表答案不能套这句话，得说清它来自离线答案表、实时扫描只是再验证一遍。
  // 首屏显示的不是主写法（那天的主写法在前 10 亿位内从未出现）时，得说明这个替换从何而来。
  const swapped = answer !== null && answer.digits !== primaryDigits;
  const primaryAbsent = primaryState != null && primaryState.firstHit === null;
  const noteText = pending
    ? '离线答案表覆盖 1900–2100 的每一天，位次在打开页面之前就已扫好。'
    : answer && snapshot
      ? fromTable
        ? swapped && primaryAbsent
          ? swappedNote(primaryDigits, answer.knownThrough ?? 0)
          : // 第三个参数是「这一轮实时扫描真正会覆盖到多深」，不是数据源的容量：
            // 本机服务够到 10 亿位，但默认只扫到 1000 万位，深处的位次不能吹成「会自己再验证一遍」
            tableNote(answer.knownThrough ?? 0, scanReach, answer.position)
        : answer.digits === primaryDigits
          ? '扫到 ' + withUnit(snapshot.scannedDigits, '位') + '就命中，命中即停'
          : ''
      : '';

  const parallax = reduced
    ? undefined
    : {
        transform: 'translateY(' + (-12 * progress).toFixed(2) + '%)',
        opacity: String(Math.max(0.1, 1 - progress * 1.15)),
      };

  return (
    <section id="hero" ref={ref} className={'stage tone-' + tone} aria-labelledby="hero-title">
      {/* 全页唯一的 h1：视觉上由巨型数字承担标题，这里给读屏与地标一个可命名的页面标题 */}
      <h1 id="hero-title" className="sr-only">
        π 里的今天 —— 你的日期藏在圆周率的第几位
      </h1>
      <div className="stage-glow" aria-hidden="true" />
      <div className="stage-inner" style={parallax}>
        <p className="stage-eyebrow">
          <span className={'badge' + (isToday ? ' badge-live' : '')}>{isToday ? '今天 · 实时' : '指定日期'}</span>
          <span className="stage-date">{formatChineseDate(date)}</span>
          <span className="stage-clock">{formatClock(now)}</span>
        </p>
        <p className="stage-kicker">{kindLabel}</p>
        {/* 巨型数字是逐帧计数的动画，对读屏来说是无意义的中间值：
            这里整块隐藏，另给一个只在结论稳定时才变动的 sr-only live 区域 */}
        <div className="stage-number" aria-hidden="true">
          {prefix ? <span className="stage-number-prefix">{prefix}</span> : null}
          {pending ? (
            // 里面放一个不可见的 0：骨架条于是和最终数字共用同一条基线，表到时不会上下跳
            <span className="stage-number-skeleton">0</span>
          ) : (
            <span className="stage-number-value" style={numberWidth ? { minWidth: numberWidth } : undefined}>
              {display}
            </span>
          )}
          {suffix ? <span className="stage-number-suffix">{suffix}</span> : null}
        </div>
        <p className="sr-only" aria-live="polite">
          {pending
            ? '正在读取离线答案表，读完后会播报这一天的位次'
            : value === null
              ? ''
              : kind === 'position'
                ? (answer ? answer.label + ' ' + answer.digits + ' 首次出现在 π 的小数点后第 ' : '位次在 π 的小数点后第 ') +
                  formatThousands(value) +
                  ' 位'
                : kind === 'scanned'
                  ? '还没锁定位次，已扫描到第 ' + formatThousands(value) + ' 位'
                  : ''}
        </p>
        <p className="stage-caption">{caption}</p>
        {/* 备注槽位始终存在（空字符串也占一行）：表回来时它从「加载中」换成结论，不会推挤下面内容 */}
        <p className="stage-note">{noteText}</p>
        {!pending && primaryState?.firstHitConfirmed !== true && source?.kind === 'server' ? (
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

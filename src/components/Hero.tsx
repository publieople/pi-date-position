import { IconArrowLeft, IconArrowRight, IconCheck, IconCopy, IconShare } from './Icons';
import { Needle } from './Needle';
import { blankReadings } from '../lib/answers';
import { dayOfYear, daysInYear, formatCn, formatDot, weekdayName } from '../lib/date';
import { formatDepth, formatNumber } from '../lib/format';
import { useCountUp } from '../lib/useCountUp';
import type { DateParts, Reading, SlotId } from '../lib/types';

interface HeroProps {
  date: DateParts;
  readings: Reading[];
  reading: Reading | null;
  loading: boolean;
  depth: number;
  copied: boolean;
  onSelectSlot: (slot: SlotId) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onShare: () => void;
  onCopy: () => void;
}

function scaleWidth(position: number | null): string {
  if (position === null) {
    return '0%';
  }
  const percent = Math.max(1.5, Math.min(100, (Math.log10(position) / 9) * 100));
  return percent.toFixed(2) + '%';
}

export function Hero({
  date,
  readings,
  reading,
  loading,
  depth,
  copied,
  onSelectSlot,
  onPrev,
  onNext,
  onToday,
  onShare,
  onCopy,
}: HeroProps) {
  const rows = readings.length > 0 ? readings : blankReadings(date);
  const position = reading?.position ?? null;
  const missing = !loading && reading !== null && position === null;
  const animated = useCountUp(position);
  const numberText = missing ? '未出现' : animated === null ? '—' : formatNumber(animated);
  const finalText = reading
    ? missing
      ? '在前 10 亿位内未出现'
      : '第 ' + formatNumber(position) + ' 位'
    : '正在读取';
  const headingLabel = 'π 日签：' + formatCn(date) + '，' + (reading ? reading.label + '，' + finalText : '正在读取');

  return (
    <section id="today" className="hero" aria-labelledby="hero-heading">
      <div className="hero__grid">
        <div className="hero__main">
          <div className="hero__kicker">
            <span className="eyebrow">TODAY&apos;S READING</span>
            <span className="hero__rule" aria-hidden="true" />
            <span className="mono hero__daycount">
              DAY {String(dayOfYear(date) + 1).padStart(3, '0')} / {daysInYear(date.year)}
            </span>
          </div>

          <div className="hero__date-row">
            <p className="hero__date">{formatDot(date)}</p>
            <p className="hero__weekday">{weekdayName(date)}</p>
          </div>

          <h1 id="hero-heading" className={'hero__display' + (missing ? ' is-missing' : '') + (loading ? ' is-loading' : '')} aria-label={headingLabel}>
            {missing ? (
              <span className="hero__missing">未出现</span>
            ) : (
              <>
                <span className="hero__ordinal">第</span>
                <span className="hero__number" aria-hidden="true">
                  {loading ? <span className="skeleton hero__skeleton" /> : numberText}
                </span>
                <span className="hero__ordinal">位</span>
              </>
            )}
          </h1>

          <p className="hero__lede" aria-live="polite">
            {loading ? (
              '正在从离线答案表读取这一天…'
            ) : reading ? (
              <>
                <span className="mono hero__encoded">{reading.encoded}</span>
                {missing ? ' 在前 10 亿位内没有出现' : ' 首次出现在 π 的小数点后'}
              </>
            ) : (
              '暂时没有读到这一天的答案'
            )}
          </p>

          <p className="hero__count">
            {loading
              ? '位次与出现次数来自本地答案表'
              : reading && reading.count !== null
                ? '前 ' + formatDepth(depth) + '内出现 ' + formatNumber(reading.count) + ' 次'
                : '口径：完整落点，允许重叠'}
          </p>

          {reading ? <Needle value={reading.encoded} /> : null}

          <div className="hero__actions">
            <div className="button-group" role="group" aria-label="切换前后日期">
              <button className="button button--icon" type="button" onClick={onPrev} aria-label="前一天（左方向键）" title="前一天">
                <IconArrowLeft />
              </button>
              <button className="button button--icon" type="button" onClick={onNext} aria-label="后一天（右方向键）" title="后一天">
                <IconArrowRight />
              </button>
            </div>
            <button className="button" type="button" onClick={onToday}>
              回到今天 <kbd>T</kbd>
            </button>
            <button className="button" type="button" onClick={onShare} disabled={!reading}>
              <IconShare size={16} /> 分享 <kbd>S</kbd>
            </button>
            <button className="button" type="button" onClick={onCopy} disabled={!reading}>
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied ? '已复制' : '复制摘要'}
            </button>
          </div>

          <p className="hero__hint">
            <kbd>←</kbd> <kbd>→</kbd> 切换日期 · <kbd>T</kbd> 回到今天 · <kbd>S</kbd> 分享 · 点日期可直接跳转
          </p>
        </div>

        <aside className="hero__spec" aria-labelledby="spec-title">
          <div className="spec__head">
            <h2 id="spec-title" className="eyebrow">
              六种写法
            </h2>
            <span className="spec__hint">点击切换</span>
          </div>

          <div className="spec__grid spec__grid--head" aria-hidden="true">
            <span>写法</span>
            <span>数字</span>
            <span>位次</span>
            <span>次数</span>
          </div>

          <div className="spec__rows">
            {rows.map((row) => {
              const active = reading?.slot === row.slot;
              return (
                <button
                  key={row.slot}
                  type="button"
                  className={'spec__row' + (active ? ' is-active' : '')}
                  aria-pressed={active}
                  onClick={() => onSelectSlot(row.slot)}
                >
                  <span className="spec__label">{row.label}</span>
                  <span className="spec__encoded mono">{row.encoded}</span>
                  <span className="spec__position">
                    {loading ? <span className="skeleton skeleton--text" /> : row.position === null ? '未出现' : formatNumber(row.position)}
                  </span>
                  <span className="spec__count">{loading ? '…' : row.count === null ? '—' : '×' + formatNumber(row.count)}</span>
                  <span className="spec__bar" aria-hidden="true">
                    <span className="spec__bar-fill" style={{ width: scaleWidth(row.position) }} />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="spec__note">位次口径：完整数字第一次完整落下的位置；次数允许重叠。</p>
        </aside>
      </div>
    </section>
  );
}

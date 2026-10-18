import { dateRangeDays } from '../lib/date';
import { formatDepth, formatNumber, formatPercent } from '../lib/format';
import type { Reading, SlotId } from '../lib/types';

interface DepthScaleProps {
  readings: Reading[];
  selectedSlot: SlotId | null;
  depth: number;
  loading: boolean;
  missing: number | null;
  onSelect: (slot: SlotId) => void;
}

const TICKS = [
  { exponent: 0, label: '1' },
  { exponent: 2, label: '10²' },
  { exponent: 4, label: '10⁴' },
  { exponent: 6, label: '10⁶' },
  { exponent: 8, label: '10⁸' },
  { exponent: 9, label: '10⁹' },
];

function percentFor(exponent: number): string {
  return (Math.max(0, Math.min(9, exponent)) / 9) * 100 + '%';
}

export function DepthScale({ readings, selectedSlot, depth, loading, missing, onSelect }: DepthScaleProps) {
  const selected = readings.find((reading) => reading.slot === selectedSlot) || null;
  const position = selected?.position ?? null;
  const gap = position === null ? null : depth - position;
  const total = dateRangeDays() * 6;

  return (
    <section id="scale" className="section section--scale" aria-labelledby="scale-title" data-reveal>
      <header className="section__head">
        <p className="eyebrow">03 / 深度</p>
        <h2 id="scale-title">
          位次不是<em>线性的</em>
        </h2>
        <p className="section__lead">
          第 1,223 位和第 131,535,897 位，听起来差得很远；放到十亿位的尺度上，它们都还在很靠前的地方。这条尺子用对数刻度，把六个写法放在同一张图上。
        </p>
      </header>

      <div className="scale">
        <div className="scale__stats">
          <div className="scale__stat">
            <span className="scale__stat-label">当前写法</span>
            <strong className="scale__stat-value mono">{selected?.label || '—'}</strong>
          </div>
          <div className="scale__stat">
            <span className="scale__stat-label">位次</span>
            <strong className="scale__stat-value">
              {loading ? '…' : position === null ? '未出现' : formatNumber(position)}
            </strong>
          </div>
          <div className="scale__stat">
            <span className="scale__stat-label">占 10 亿</span>
            <strong className="scale__stat-value">{loading ? '…' : formatPercent(position, depth)}</strong>
          </div>
          <div className="scale__stat">
            <span className="scale__stat-label">距 10 亿还差</span>
            <strong className="scale__stat-value">{loading || gap === null ? '…' : formatNumber(gap) + ' 位'}</strong>
          </div>
        </div>

        <div className="depth-ruler" role="group" aria-label="六个写法的位次对数刻度">
          <div className="depth-ruler__surface">
            <div className="depth-ruler__axis" aria-hidden="true" />
            {TICKS.map((tick) => (
              <span className="depth-ruler__tick" style={{ left: percentFor(tick.exponent) }} key={tick.exponent}>
                <span className="depth-ruler__gridline" aria-hidden="true" />
                <span className="depth-ruler__tick-label mono">{tick.label}</span>
              </span>
            ))}
            {readings.map((reading, index) => {
              if (reading.position === null) {
                return null;
              }
              const left = percentFor(Math.log10(reading.position));
              return (
                <button
                  key={reading.slot}
                  type="button"
                  className={'depth-ruler__marker' + (reading.slot === selectedSlot ? ' is-active' : '')}
                  style={{ left: left, bottom: 30 + (index % 3) * 28 + 'px' }}
                  onClick={() => onSelect(reading.slot)}
                  aria-label={reading.label + '，第 ' + formatNumber(reading.position) + ' 位'}
                >
                  <span className="depth-ruler__name mono" aria-hidden="true">
                    {reading.label}
                  </span>
                  <span className="depth-ruler__dot" aria-hidden="true" />
                  <span className="depth-ruler__tooltip">
                    <span className="mono">{reading.label}</span>
                    <span>第 {formatNumber(reading.position)} 位</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="scale__legend">
          <span>对数刻度：每往右一格，位次乘 100。</span>
          <span className="mono">
            {formatNumber(total)} 个读数 · {missing === null ? '—' : formatNumber(missing)} 个未出现
          </span>
          <span>扫描深度 {formatDepth(depth)}</span>
        </div>
      </div>
    </section>
  );
}

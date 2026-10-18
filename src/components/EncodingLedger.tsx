import { blankReadings } from '../lib/answers';
import { formatDepth, formatNumber } from '../lib/format';
import type { DateParts, Reading, SlotId } from '../lib/types';

interface EncodingLedgerProps {
  date: DateParts;
  readings: Reading[];
  loading: boolean;
  selectedSlot: SlotId | null;
  depth: number;
  onSelect: (slot: SlotId) => void;
}

function barWidth(position: number | null): string {
  if (position === null) {
    return '0%';
  }
  return Math.max(1.5, Math.min(100, (Math.log10(position) / 9) * 100)).toFixed(2) + '%';
}

export function EncodingLedger({ date, readings, loading, selectedSlot, depth, onSelect }: EncodingLedgerProps) {
  const rows = readings.length > 0 ? readings : blankReadings(date);

  return (
    <section id="encodings" className="section section--encodings" aria-labelledby="encodings-title" data-reveal>
      <header className="section__head">
        <p className="eyebrow">01 / 六种写法</p>
        <h2 id="encodings-title">
          同一串数字，<em>六种写法</em>
        </h2>
        <p className="section__lead">
          年月日、月日、日月、两位年、美国写法、欧洲写法——每一种都是一串数字，在 π 里各自有它第一次出现的位置。
        </p>
      </header>

      <div className="ledger-grid">
        {rows.map((reading, index) => {
          const active = reading.slot === selectedSlot;
          const missing = !loading && reading.position === null;
          return (
            <button
              key={reading.slot}
              type="button"
              className={'ledger-card' + (active ? ' is-active' : '') + (missing ? ' is-missing' : '') + (loading ? ' is-loading' : '')}
              aria-pressed={active}
              onClick={() => onSelect(reading.slot)}
            >
              <span className="ledger-card__top">
                <span className="ledger-card__index mono">{String(index + 1).padStart(2, '0')}</span>
                <span className="ledger-card__label mono">{reading.label}</span>
                <span className="ledger-card__status" aria-hidden="true">
                  {active ? '●' : ''}
                </span>
              </span>
              <span className="ledger-card__encoded mono">{reading.encoded}</span>
              <span className="ledger-card__name">{reading.name}</span>

              <span className="ledger-card__reading">
                <span className="ledger-card__caption">小数点后第</span>
                <span className="ledger-card__position">
                  {loading ? <span className="skeleton skeleton--text" /> : reading.position === null ? '未出现' : formatNumber(reading.position)}
                </span>
                {reading.position !== null ? <span className="ledger-card__caption">位</span> : null}
              </span>

              <span className="ledger-card__count">
                {loading
                  ? '正在读取次数'
                  : reading.count === null
                    ? '前 ' + formatDepth(depth) + '内未出现'
                    : '前 ' + formatDepth(depth) + '内出现 ' + formatNumber(reading.count) + ' 次'}
              </span>

              <span className="ledger-card__bar" aria-hidden="true">
                <span className="ledger-card__bar-fill" style={{ width: barWidth(reading.position) }} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="section__footnote">按对数比例显示：条越长，位次越深。次数允许重叠。</p>
    </section>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { IconArrowLeft, IconArrowRight, IconRefresh } from './Icons';
import { loadYear } from '../lib/answers';
import {
  addDays,
  addMonths,
  dayOfYear,
  daysInMonth,
  daysInYear,
  isInRange,
  parseISODate,
  toDateKey,
} from '../lib/date';
import { formatNumber } from '../lib/format';
import { SLOT_META, isSlotId, slotIndex } from '../lib/types';
import type { DateParts, SlotId, YearAnswers } from '../lib/types';

interface YearAtlasProps {
  date: DateParts;
  slot: SlotId;
  onSelectDate: (date: DateParts) => void;
  onSelectSlot: (slot: SlotId) => void;
}

interface HoverInfo {
  key: string;
  date: DateParts;
  position: number | null;
  count: number | null;
  x: number;
  y: number;
}

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const YEARS = Array.from({ length: 201 }, (_, index) => 1900 + index);

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '读取失败，请稍后再试';
}

export function YearAtlas({ date, slot, onSelectDate, onSelectSlot }: YearAtlasProps) {
  const [year, setYear] = useState(date.year);
  const [data, setData] = useState<YearAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeKey, setActiveKey] = useState<string>(toDateKey(date));
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    setYear(date.year);
  }, [date.year]);

  useEffect(() => {
    setActiveKey((previous) => {
      const parsed = parseISODate(previous);
      if (parsed && parsed.year === year) {
        return previous;
      }
      return toDateKey({ year: year, month: 1, day: 1 });
    });
  }, [year]);

  useEffect(() => {
    setActiveKey(toDateKey(date));
  }, [date]);

  useEffect(() => {
    if (!data || date.year !== year) {
      return;
    }
    const node = cellRefs.current.get(toDateKey(date));
    const scroller = node?.closest('.atlas__scroll');
    if (!node || !scroller) {
      return;
    }
    const nodeRect = node.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    if (nodeRect.left < scrollerRect.left || nodeRect.right > scrollerRect.right) {
      scroller.scrollLeft += nodeRect.left - scrollerRect.left - (scrollerRect.width - nodeRect.width) / 2;
    }
  }, [data, date, year]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setData(null);
    loadYear(year)
      .then((result) => {
        if (alive) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((nextError) => {
        if (alive) {
          setError(errorMessage(nextError));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [year, reloadKey]);

  useEffect(() => {
    if (!data) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (year > 1900) {
        void loadYear(year - 1).catch(() => undefined);
      }
      if (year < 2100) {
        void loadYear(year + 1).catch(() => undefined);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [data, year]);

  const stats = useMemo(() => {
    if (!data) {
      return null;
    }
    let max = 0;
    let missing = 0;
    const positions: number[] = [];
    data.days.forEach((row) => {
      row.forEach((cell) => {
        if (cell === null) {
          missing += 1;
        } else {
          positions.push(cell[0]);
          if (cell[0] > max) {
            max = cell[0];
          }
        }
      });
    });
    positions.sort((a, b) => a - b);
    const levelByPosition = new Map<number, number>();
    positions.forEach((position, index) => {
      const level = 1 + Math.round((index / Math.max(1, positions.length - 1)) * 8);
      if (!levelByPosition.has(position)) {
        levelByPosition.set(position, level);
      }
    });
    return {
      max: max,
      missing: missing,
      total: daysInYear(year) * 6,
      levelFor: (position: number | null) => (position === null ? 0 : levelByPosition.get(position) ?? 1),
    };
  }, [data, year]);

  function showHover(button: HTMLButtonElement, info: Omit<HoverInfo, 'x' | 'y'>) {
    const rect = button.getBoundingClientRect();
    setHover({
      key: info.key,
      date: info.date,
      position: info.position,
      count: info.count,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const element = event.target as HTMLElement;
    const button = element.closest('button[data-date]');
    if (!button) {
      return;
    }
    const current = parseISODate(button.getAttribute('data-date') || '');
    if (!current) {
      return;
    }
    let next: DateParts | null = null;
    if (event.key === 'ArrowRight') {
      next = addDays(current, 1);
    } else if (event.key === 'ArrowLeft') {
      next = addDays(current, -1);
    } else if (event.key === 'ArrowDown') {
      next = addMonths(current, 1);
    } else if (event.key === 'ArrowUp') {
      next = addMonths(current, -1);
    } else if (event.key === 'Home') {
      next = { year: current.year, month: current.month, day: 1 };
    } else if (event.key === 'End') {
      next = { year: current.year, month: current.month, day: daysInMonth(current.year, current.month) };
    } else {
      return;
    }
    event.preventDefault();
    if (next.year !== year || !isInRange(next)) {
      return;
    }
    const key = toDateKey(next);
    setActiveKey(key);
    const node = cellRefs.current.get(key);
    if (node) {
      node.focus();
    }
  }

  const selectedKey = toDateKey(date);
  const ready = data !== null && !loading;
  const activeYear = year;

  return (
    <section id="atlas" className="section section--atlas" aria-labelledby="atlas-title" data-reveal>
      <header className="section__head">
        <p className="eyebrow">04 / 年份图集</p>
        <h2 id="atlas-title">
          一眼看见<em>整年</em>
        </h2>
        <p className="section__lead">
          每一天都是一格。颜色越深，位次在当年越靠后；空格子表示这一天在这个写法下没有出现。点一格就能把它送到首屏。
        </p>
      </header>

      <div className="atlas" aria-busy={loading}>
        <div className="atlas__toolbar">
          <div className="atlas__year-control">
            <button
              className="button button--icon"
              type="button"
              onClick={() => setYear(Math.max(1900, year - 1))}
              disabled={year <= 1900}
              aria-label="上一年"
            >
              <IconArrowLeft />
            </button>
            <label className="atlas__select-label" htmlFor="atlas-year">
              <span className="sr-only">选择年份</span>
              <select
                id="atlas-year"
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
                aria-label="选择年份"
              >
                {YEARS.map((option) => (
                  <option value={option} key={option}>
                    {option} 年
                  </option>
                ))}
              </select>
            </label>
            <button
              className="button button--icon"
              type="button"
              onClick={() => setYear(Math.min(2100, year + 1))}
              disabled={year >= 2100}
              aria-label="下一年"
            >
              <IconArrowRight />
            </button>
          </div>

          <div className="atlas__slot-control">
            <label className="atlas__select-label" htmlFor="atlas-slot">
              <span className="atlas__control-label">写法</span>
              <select
                id="atlas-slot"
                value={slot}
                onChange={(event) => {
                  const next = event.target.value;
                  if (isSlotId(next)) {
                    onSelectSlot(next);
                  }
                }}
                aria-label="图集使用的日期写法"
              >
                {SLOT_META.map((meta) => (
                  <option value={meta.id} key={meta.id}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="atlas__stats" aria-live="polite">
            {stats ? (
              <>
                <span>
                  最深 <strong className="mono">{formatNumber(stats.max)}</strong> 位
                </span>
                <span>
                  缺失 <strong className="mono">{formatNumber(stats.missing)}</strong> / {formatNumber(stats.total)}
                </span>
                <span>{daysInYear(activeYear)} 天</span>
              </>
            ) : (
              <span>{loading ? '正在读取 ' + year + ' 年…' : '等待数据'}</span>
            )}
          </div>
        </div>

        {error ? (
          <div className="inline-error" role="alert">
            <span>{error}</span>
            <button className="button button--small" type="button" onClick={() => setReloadKey((key) => key + 1)}>
              <IconRefresh size={15} /> 重试
            </button>
          </div>
        ) : (
          <div className="atlas__scroll">
            <div
              className="atlas-grid"
              role="grid"
              aria-label={year + ' 年 ' + slot + ' 位次热力图'}
              onKeyDown={handleGridKeyDown}
              aria-rowcount={13}
              aria-colcount={32}
            >
              <div className="atlas-grid__head" role="row">
                <span className="atlas-grid__corner" role="columnheader" aria-label="月份" />
                {DAYS.map((day) => (
                  <span
                    className={'atlas-grid__day' + (day % 5 === 1 || day === 31 ? ' is-labeled' : '')}
                    role="columnheader"
                    key={day}
                  >
                    {day % 5 === 1 || day === 31 ? day : ''}
                  </span>
                ))}
              </div>

              {MONTHS.map((month) => (
                <div className="atlas-grid__row" role="row" key={month}>
                  <span className="atlas-grid__month" role="rowheader">
                    {month} 月
                  </span>
                  {DAYS.map((day) => {
                    if (day > daysInMonth(year, month)) {
                      return <span className="atlas-cell atlas-cell--void" role="gridcell" aria-hidden="true" key={day} />;
                    }
                    const cellDate: DateParts = { year: year, month: month, day: day };
                    const key = toDateKey(cellDate);
                    const row = data ? data.days[dayOfYear(cellDate)] : null;
                    const cell = row ? row[slotIndex(slot)] : null;
                    const level = stats ? stats.levelFor(cell ? cell[0] : null) : 0;
                    const isSelected = key === selectedKey;
                    const isActive = key === activeKey;
                    const ariaLabel =
                      year + ' 年 ' + month + ' 月 ' + day + ' 日，' +
                      (ready
                        ? cell
                          ? '第 ' + formatNumber(cell[0]) + ' 位，出现 ' + formatNumber(cell[1]) + ' 次'
                          : '前 10 亿位内未出现'
                        : '正在读取');
                    return (
                      <button
                        key={day}
                        ref={(node) => {
                          if (node) {
                            cellRefs.current.set(key, node);
                          } else {
                            cellRefs.current.delete(key);
                          }
                        }}
                        type="button"
                        role="gridcell"
                        tabIndex={isActive ? 0 : -1}
                        data-date={key}
                        data-level={level}
                        className={'atlas-cell' + (isSelected ? ' is-selected' : '') + (loading ? ' is-loading' : '')}
                        aria-label={ariaLabel}
                        aria-selected={isSelected}
                        disabled={!ready}
                        onClick={() => onSelectDate(cellDate)}
                        onMouseEnter={(event) =>
                          showHover(event.currentTarget, {
                            key: key,
                            date: cellDate,
                            position: cell ? cell[0] : null,
                            count: cell ? cell[1] : null,
                          })
                        }
                        onMouseLeave={() => setHover(null)}
                        onFocus={(event) => {
                          setActiveKey(key);
                          showHover(event.currentTarget, {
                            key: key,
                            date: cellDate,
                            position: cell ? cell[0] : null,
                            count: cell ? cell[1] : null,
                          });
                        }}
                        onBlur={() => setHover(null)}
                      >
                        <span className="sr-only">
                          {month} 月 {day} 日
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="atlas__footer">
          <div className="atlas-legend" aria-label="颜色图例：越深位次越深">
            <span className="atlas-legend__label">浅</span>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => (
              <span className="atlas-legend__swatch" data-level={level} key={level} aria-hidden="true" />
            ))}
            <span className="atlas-legend__label">深</span>
          </div>
          <p className="atlas__hint">
            颜色按当年位次的相对分位分档（越深越靠后）；方向键移动，Home / End 到月初 / 月末。切到其他年份会自动预取相邻年份。
          </p>
        </div>

        {hover ? (
          <div className="atlas-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
            <span className="mono">{hover.key}</span>
            <span>{hover.position === null ? '前 10 亿位内未出现' : '第 ' + formatNumber(hover.position) + ' 位'}</span>
            {hover.count !== null ? <span>×{formatNumber(hover.count)}</span> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

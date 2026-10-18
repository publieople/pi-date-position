import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  clampDate,
  dateRangeDays,
  dayOfYear,
  daysInYear,
  encodeDate,
  formatCn,
  formatDot,
  isValidDate,
  parseISODate,
  toDateKey,
  weekdayName,
} from '../lib/date';

describe('date helpers', () => {
  it('counts leap years correctly', () => {
    expect(daysInYear(1900)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
    expect(daysInYear(2028)).toBe(366);
    expect(daysInYear(2100)).toBe(365);
  });

  it('uses zero-based day-of-year', () => {
    expect(dayOfYear({ year: 2026, month: 1, day: 1 })).toBe(0);
    expect(dayOfYear({ year: 2026, month: 10, day: 18 })).toBe(290);
    expect(dayOfYear({ year: 2026, month: 12, day: 31 })).toBe(364);
    expect(dayOfYear({ year: 2028, month: 2, day: 29 })).toBe(59);
  });

  it('crosses year boundaries', () => {
    expect(addDays({ year: 2026, month: 12, day: 31 }, 1)).toEqual({ year: 2027, month: 1, day: 1 });
    expect(addDays({ year: 2028, month: 2, day: 28 }, 1)).toEqual({ year: 2028, month: 2, day: 29 });
    expect(addMonths({ year: 2026, month: 1, day: 31 }, 1)).toEqual({ year: 2026, month: 2, day: 28 });
    expect(addMonths({ year: 2026, month: 12, day: 15 }, 1)).toEqual({ year: 2027, month: 1, day: 15 });
  });

  it('validates calendar dates', () => {
    expect(isValidDate({ year: 2028, month: 2, day: 29 })).toBe(true);
    expect(isValidDate({ year: 1900, month: 2, day: 29 })).toBe(false);
    expect(isValidDate({ year: 2026, month: 4, day: 31 })).toBe(false);
  });

  it('parses and writes ISO dates', () => {
    expect(parseISODate('2026-10-18')).toEqual({ year: 2026, month: 10, day: 18 });
    expect(parseISODate('2026-02-30')).toBeNull();
    expect(toDateKey({ year: 2026, month: 10, day: 8 })).toBe('2026-10-08');
  });

  it('clamps to the supported range', () => {
    expect(clampDate({ year: 1800, month: 1, day: 1 })).toEqual({ year: 1900, month: 1, day: 1 });
    expect(clampDate({ year: 2200, month: 1, day: 1 })).toEqual({ year: 2100, month: 12, day: 31 });
    expect(dateRangeDays()).toBe(73414);
  });

  it('encodes all six date forms', () => {
    const date = { year: 2026, month: 10, day: 8 };
    expect(encodeDate(date, 'yyyyMMdd')).toBe('20261008');
    expect(encodeDate(date, 'mmDd')).toBe('1008');
    expect(encodeDate(date, 'ddMm')).toBe('0810');
    expect(encodeDate(date, 'yyMMdd')).toBe('261008');
    expect(encodeDate(date, 'mmDdYyyy')).toBe('10082026');
    expect(encodeDate(date, 'ddMmYyyy')).toBe('08102026');
  });

  it('formats Chinese labels', () => {
    expect(formatDot({ year: 2026, month: 10, day: 18 })).toBe('2026.10.18');
    expect(formatCn({ year: 2026, month: 10, day: 18 })).toBe('2026 年 10 月 18 日');
    expect(weekdayName({ year: 2026, month: 10, day: 18 })).toBe('星期日');
  });
});

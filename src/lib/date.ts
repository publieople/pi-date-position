import type { DateParts, SlotId } from './types';

export const DAY_MS = 86_400_000;
export const MIN_DATE: DateParts = { year: 1900, month: 1, day: 1 };
export const MAX_DATE: DateParts = { year: 2100, month: 12, day: 31 };

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function pad2(value: number): string {
  return value < 10 ? '0' + value : String(value);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysInYear(year: number): number {
  return dayOfYear({ year: year, month: 12, day: 31 }) + 1;
}

export function isValidDate(date: DateParts): boolean {
  if (!Number.isInteger(date.year) || !Number.isInteger(date.month) || !Number.isInteger(date.day)) {
    return false;
  }
  if (date.month < 1 || date.month > 12) {
    return false;
  }
  return date.day >= 1 && date.day <= daysInMonth(date.year, date.month);
}

export function isInRange(date: DateParts): boolean {
  return compareDate(date, MIN_DATE) >= 0 && compareDate(date, MAX_DATE) <= 0;
}

export function compareDate(a: DateParts, b: DateParts): number {
  const av = a.year * 10000 + a.month * 100 + a.day;
  const bv = b.year * 10000 + b.month * 100 + b.day;
  return av === bv ? 0 : av < bv ? -1 : 1;
}

export function dayOfYear(date: DateParts): number {
  const start = Date.UTC(date.year, 0, 1);
  const current = Date.UTC(date.year, date.month - 1, date.day);
  return Math.round((current - start) / DAY_MS);
}

export function addDays(date: DateParts, delta: number): DateParts {
  const stamp = Date.UTC(date.year, date.month - 1, date.day) + delta * DAY_MS;
  const next = new Date(stamp);
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function addMonths(date: DateParts, delta: number): DateParts {
  const rawMonth = date.month - 1 + delta;
  const year = date.year + Math.floor(rawMonth / 12);
  const month = ((rawMonth % 12) + 12) % 12 + 1;
  const day = Math.min(date.day, daysInMonth(year, month));
  return { year: year, month: month, day: day };
}

export function clampDate(date: DateParts): DateParts {
  if (compareDate(date, MIN_DATE) < 0) {
    return { year: MIN_DATE.year, month: MIN_DATE.month, day: MIN_DATE.day };
  }
  if (compareDate(date, MAX_DATE) > 0) {
    return { year: MAX_DATE.year, month: MAX_DATE.month, day: MAX_DATE.day };
  }
  return { year: date.year, month: date.month, day: date.day };
}

export function toDateKey(date: DateParts): string {
  return String(date.year) + '-' + pad2(date.month) + '-' + pad2(date.day);
}

export function parseISODate(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const date: DateParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  return isValidDate(date) ? date : null;
}

export function todayParts(now: Date = new Date()): DateParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function weekdayName(date: DateParts): string {
  const stamp = Date.UTC(date.year, date.month - 1, date.day);
  return WEEKDAYS[new Date(stamp).getUTCDay()] || '';
}

export function formatDot(date: DateParts): string {
  return String(date.year) + '.' + pad2(date.month) + '.' + pad2(date.day);
}

export function formatCn(date: DateParts): string {
  return String(date.year) + ' 年 ' + date.month + ' 月 ' + date.day + ' 日';
}

export function daysBetween(a: DateParts, b: DateParts): number {
  const from = Date.UTC(a.year, a.month - 1, a.day);
  const to = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((to - from) / DAY_MS);
}

export function dateRangeDays(): number {
  return daysBetween(MIN_DATE, MAX_DATE) + 1;
}

export function encodeDate(date: DateParts, slot: SlotId): string {
  switch (slot) {
    case 'yyyyMMdd':
      return String(date.year) + pad2(date.month) + pad2(date.day);
    case 'mmDd':
      return pad2(date.month) + pad2(date.day);
    case 'ddMm':
      return pad2(date.day) + pad2(date.month);
    case 'yyMMdd':
      return pad2(date.year % 100) + pad2(date.month) + pad2(date.day);
    case 'mmDdYyyy':
      return pad2(date.month) + pad2(date.day) + String(date.year);
    case 'ddMmYyyy':
      return pad2(date.day) + pad2(date.month) + String(date.year);
    default:
      return String(date.year) + pad2(date.month) + pad2(date.day);
  }
}

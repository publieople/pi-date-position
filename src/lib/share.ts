import { formatCn, toDateKey } from './date';
import { formatNumber } from './format';
import type { DateParts, Reading, SlotId } from './types';

export function shareUrl(date: DateParts, slot: SlotId): string {
  const url = new URL(window.location.href);
  url.searchParams.set('date', toDateKey(date));
  if (slot !== 'yyyyMMdd') {
    url.searchParams.set('slot', slot);
  } else {
    url.searchParams.delete('slot');
  }
  url.hash = '';
  return url.toString();
}

export function shareText(date: DateParts, reading: Reading | null, depth: number): string {
  const dateLabel = formatCn(date);
  if (!reading) {
    return dateLabel + '：正在读取它在 π 中的位置。';
  }
  if (reading.position === null) {
    return dateLabel + '，' + reading.label + '（' + reading.encoded + '）在前 10 亿位内没有出现。';
  }
  let text =
    dateLabel +
    '，' +
    reading.label +
    '（' +
    reading.encoded +
    '）第一次出现在 π 的小数点后第 ' +
    formatNumber(reading.position) +
    ' 位';
  if (reading.count !== null) {
    text += '，前 10 亿位内出现 ' + formatNumber(reading.count) + ' 次';
  }
  text += '。数据深度 ' + formatNumber(depth) + ' 位。';
  return text;
}

export function pageTitle(date: DateParts, reading: Reading | null): string {
  const dateLabel = toDateKey(date);
  if (!reading) {
    return dateLabel + ' · π 日签';
  }
  if (reading.position === null) {
    return dateLabel + ' · 未出现 · π 日签';
  }
  return dateLabel + ' · 第 ' + formatNumber(reading.position) + ' 位 · π 日签';
}

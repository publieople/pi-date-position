// 位置口径与格式化。
// 口径：所有位置都是「小数点后第 k 位」，k 从 1 开始；上游 MIT 文件第 0 字节是整数位 3，
// 因此第 k 位 = 文件字节偏移 k+1（与 api.pi.delivery 的 start=k 一致）。
export const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];

export function byteOffsetOfPosition(position: number): number {
  return position + 1;
}

export function formatThousands(value: number): string {
  const negative = value < 0;
  const digits = String(Math.trunc(Math.abs(value)));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  return (negative ? '-' : '') + out;
}

/** 12.3 万 / 4.56 亿 这类紧凑写法 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e8) return trimZero(value / 1e8) + ' 亿';
  if (abs >= 1e4) return trimZero(value / 1e4) + ' 万';
  return formatThousands(value);
}

function trimZero(value: number): string {
  const fixed = value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(1) : value.toFixed(2);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

export function formatDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—';
  if (ms < 1000) return Math.max(0, Math.round(ms)) + ' ms';
  const seconds = ms / 1000;
  if (seconds < 60) return seconds.toFixed(1) + ' 秒';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  if (minutes < 60) return minutes + ' 分 ' + rest + ' 秒';
  return Math.floor(minutes / 60) + ' 时 ' + (minutes % 60) + ' 分';
}

export function pad2(value: number): string {
  return value < 10 ? '0' + value : String(value);
}

export function toDateKey(date: Date): string {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

/** 用中午 12 点构造本地日期，避开夏令时/时区导致的跨日错误 */
export function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function formatChineseDate(date: Date): string {
  return date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日 ' + weekdayName(date);
}

export function formatClock(date: Date): string {
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes()) + ':' + pad2(date.getSeconds());
}

/**
 * 把日期键夹进 [minKey, maxKey]（YYYY-MM-DD 可直接按字符串比大小）；
 * 格式不对的键原样返回，交给 parseDateKey 去判非法。
 */
export function clampDateKey(key: string, minKey: string, maxKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key;
  if (key < minKey) return minKey;
  if (key > maxKey) return maxKey;
  return key;
}

export function weekdayName(date: Date): string {
  return '星期' + WEEKDAY_NAMES[date.getDay()];
}

/**
 * 把某一天写进地址栏：默认的「今天」不带参数（链接保持干净），其余带上 ?date=，
 * 哈希与非 date 参数原样保留；href 解析失败时原样返回。
 */
export function withDateParam(href: string, dateKey: string, todayKey: string): string {
  try {
    const url = new URL(href);
    if (dateKey === todayKey) url.searchParams.delete('date');
    else url.searchParams.set('date', dateKey);
    return url.toString();
  } catch {
    return href;
  }
}

export function describePosition(position: number): string {
  return '小数点后第 ' + formatThousands(position) + ' 位';
}

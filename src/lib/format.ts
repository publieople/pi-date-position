const NUMBER = new Intl.NumberFormat('en-US');

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return NUMBER.format(value);
}

export function formatPercent(position: number | null, depth: number): string {
  if (position === null) {
    return '—';
  }
  return ((position / depth) * 100).toFixed(2) + '%';
}

export function formatDepth(depth: number): string {
  if (depth >= 1_000_000_000) {
    return '10 亿位';
  }
  return formatNumber(depth) + ' 位';
}

export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return hours + ':' + minutes + ':' + seconds;
}

export function formatCheckedAt(date: Date): string {
  return date.toLocaleDateString('zh-CN') + ' ' + formatTime(date);
}

// 用 localStorage 记住「某个日期的某种写法，在已验证到多少位时首次出现在第几位」。
export interface CachedResult {
  position: number;
  /** 该结论已经被验证到第几位（scanned digits 水位） */
  scannedThrough: number;
  checkedAt: number;
}

const PREFIX = 'pi-date-position:v1:';

function keyOf(dateKey: string): string {
  return PREFIX + dateKey;
}

export function loadCache(dateKey: string): Record<string, CachedResult> {
  try {
    const raw = window.localStorage.getItem(keyOf(dateKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CachedResult>;
    const out: Record<string, CachedResult> = {};
    for (const [digits, value] of Object.entries(parsed)) {
      if (value && typeof value.position === 'number' && typeof value.scannedThrough === 'number') out[digits] = value;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveCache(dateKey: string, digits: string, result: CachedResult): void {
  try {
    const all = loadCache(dateKey);
    const previous = all[digits];
    if (previous && previous.position === result.position && previous.scannedThrough >= result.scannedThrough) return;
    all[digits] = result;
    window.localStorage.setItem(keyOf(dateKey), JSON.stringify(all));
  } catch {
    /* localStorage 不可用就算了 */
  }
}

export function clearCache(dateKey: string): void {
  try {
    window.localStorage.removeItem(keyOf(dateKey));
  } catch {
    /* 忽略 */
  }
}

// 纯函数：在给定文本窗口里找出所有 needle 的出现位置（绝对坐标 = 小数点后第几位）。
// 供 Worker 与主线程共用，不依赖任何 DOM / Worker API，便于单测。
export interface Needle {
  id: string;
  digits: string;
}

export interface Occurrence {
  id: string;
  /** 小数点后第 position 位（1-based，出现串的第一个字符所在位） */
  position: number;
}

export function findOccurrencesInText(text: string, windowStart: number, needles: Needle[]): Occurrence[] {
  const hits: Occurrence[] = [];
  for (const needle of needles) {
    if (!needle.digits) continue;
    let index = text.indexOf(needle.digits);
    // index + 1 而不是 +len：允许自重叠匹配（如 1111 出现在 11111 里两次）
    while (index !== -1) {
      hits.push({ id: needle.id, position: windowStart + index });
      index = text.indexOf(needle.digits, index + 1);
    }
  }
  return hits;
}

/** 覆盖水位：把「已经取回并扫描过的位数区间」合并，算出从第 1 位起连续覆盖到哪一位。 */
export class CoverageTracker {
  private intervals: Array<[number, number]> = [];

  add(start: number, end: number): void {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
    this.intervals.push([start, end]);
    this.intervals.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const current of this.intervals) {
      const last = merged[merged.length - 1];
      if (last && current[0] <= last[1] + 1) last[1] = Math.max(last[1], current[1]);
      else merged.push([current[0], current[1]]);
    }
    this.intervals = merged;
  }

  /** 从 from 位开始连续覆盖到的最后一位（没有覆盖到任何一位则返回 from - 1）。 */
  contiguousThrough(from = 1): number {
    let through = from - 1;
    for (const [start, end] of this.intervals) {
      if (start > through + 1) break;
      through = Math.max(through, end);
    }
    return through;
  }

  list(): Array<[number, number]> {
    return this.intervals.map(([a, b]) => [a, b] as [number, number]);
  }
}

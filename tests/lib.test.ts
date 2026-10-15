import { describe, expect, it } from 'vitest';
import { CoverageTracker, findOccurrencesInText } from '../src/lib/searchCore';
import { CHUNK_LADDER, chunkSizeAt, planChunk } from '../src/lib/searchEngine';
import { encodingsFor, searchNeedles } from '../src/lib/encodings';
import { byteOffsetOfPosition, formatThousands, parseDateKey, toDateKey } from '../src/lib/position';
import { tableNote } from '../src/lib/headline';

const dateOf = (key: string): Date => {
  const date = parseDateKey(key);
  if (!date) throw new Error('测试日期不合法：' + key);
  return date;
};

const digitsOf = (key: string, id: string): string => {
  const found = encodingsFor(dateOf(key)).find((e) => e.id === id);
  if (!found) throw new Error('找不到写法 ' + id);
  return found.digits;
};

describe('位次换算', () => {
  it('小数点后第 k 位 = 上游文件字节 k+1', () => {
    expect(byteOffsetOfPosition(1)).toBe(2);
    expect(byteOffsetOfPosition(762)).toBe(763);
    expect(byteOffsetOfPosition(1_000_000_000)).toBe(1_000_000_001);
  });

  it('千分位格式化', () => {
    expect(formatThousands(1)).toBe('1');
    expect(formatThousands(999)).toBe('999');
    expect(formatThousands(1000)).toBe('1,000');
    expect(formatThousands(1234567)).toBe('1,234,567');
    expect(formatThousands(1_000_000_000)).toBe('1,000,000,000');
  });
});

describe('日期解析', () => {
  it('往返一致', () => {
    for (const key of ['2026-10-14', '2028-02-29', '1980-01-01', '2035-12-31']) {
      expect(toDateKey(dateOf(key))).toBe(key);
    }
  });

  it('拒绝不存在的日期与坏格式', () => {
    expect(parseDateKey('2026-02-30')).toBeNull();
    expect(parseDateKey('2026-13-01')).toBeNull();
    expect(parseDateKey('2026-1-4')).toBeNull();
    expect(parseDateKey('')).toBeNull();
  });
});

describe('日期写法', () => {
  it('2026-10-14 的六种数字串', () => {
    expect(digitsOf('2026-10-14', 'yyyymmdd')).toBe('20261014');
    expect(digitsOf('2026-10-14', 'mmdd')).toBe('1014');
    expect(digitsOf('2026-10-14', 'ddmm')).toBe('1410');
    expect(digitsOf('2026-10-14', 'yymmdd')).toBe('261014');
    expect(digitsOf('2026-10-14', 'mmddyyyy')).toBe('10142026');
    expect(digitsOf('2026-10-14', 'ddmmyyyy')).toBe('14102026');
  });

  it('保留前导零（闰日 2028-02-29）', () => {
    expect(digitsOf('2028-02-29', 'mmdd')).toBe('0229');
    expect(digitsOf('2028-02-29', 'ddmm')).toBe('2902');
    expect(digitsOf('2028-02-29', 'yymmdd')).toBe('280229');
    expect(digitsOf('2028-02-29', 'mmddyyyy')).toBe('02292028');
    expect(digitsOf('2028-02-29', 'yyyymmdd')).toBe('20280229');
  });

  it('带连字符的写法指向相同数字串', () => {
    const list = encodingsFor(dateOf('2026-10-14'));
    expect(list.find((e) => e.id === 'iso-dashed')?.sameAs).toBe('yyyymmdd');
    expect(list.find((e) => e.id === 'md-dashed')?.sameAs).toBe('mmdd');
  });

  it('MMDD == DDMM 时合并成一条搜索串并保留两个标签（2026-11-11）', () => {
    const list = encodingsFor(dateOf('2026-11-11'));
    const needles = searchNeedles(list);
    const merged = needles.find((n) => n.digits === '1111');
    // 带分隔符的 MM-DD 也是同一串数字，所以三个标签都挂在同一条搜索串上
    expect(merged?.labels).toEqual(['MMDD', 'DDMM', 'MM-DD']);
    expect(needles.map((n) => n.digits)).toEqual(['20261111', '1111', '261111', '11112026']);
    expect(new Set(needles.map((n) => n.id)).size).toBe(needles.length);
  });

  it('搜索串 id 就是数字串本身', () => {
    for (const needle of searchNeedles(encodingsFor(dateOf('2026-10-14')))) {
      expect(needle.id).toBe(needle.digits);
    }
  });
});

describe('首屏脚注（表答案）', () => {
  it('本机数据源够得着这个位次：说会自己再验证一遍', () => {
    expect(tableNote(1_000_000_000, 1_000_000_000, 521_625_248)).toBe(
      '位次来自离线预计算表（前 10 亿位）；下面的实时扫描会自己再验证一遍'
    );
  });

  it('在线演示版只有 100 万位：不吹「会再验证一遍」', () => {
    expect(tableNote(1_000_000_000, 1_000_000, 521_625_248)).toBe(
      '位次来自离线预计算表（前 10 亿位）；本次实时扫描只有前 100 万位，这一位没法在浏览器里现场复验'
    );
  });

  it('位次本身落在静态副本范围内：仍然算能复验', () => {
    expect(tableNote(1_000_000_000, 1_000_000, 2_563)).toContain('下面的实时扫描会自己再验证一遍');
  });

  it('数据源不可用：明说没法复验', () => {
    expect(tableNote(1_000_000_000, 0, 521_625_248)).toBe(
      '位次来自离线预计算表（前 10 亿位）；本次实时扫描不可用，没法在浏览器里复验'
    );
  });
});

describe('findOccurrencesInText', () => {
  it('返回绝对位次', () => {
    expect(findOccurrencesInText('0123456789', 100, [{ id: 'a', digits: '456' }])).toEqual([
      { id: 'a', position: 104 },
    ]);
  });

  it('支持自重叠匹配', () => {
    const hits = findOccurrencesInText('aaaaa', 1, [{ id: 'a', digits: 'aa' }]);
    expect(hits.map((h) => h.position)).toEqual([1, 2, 3, 4]);
  });

  it('多条串互不干扰', () => {
    const hits = findOccurrencesInText('9912345677', 10, [
      { id: 'x', digits: '99' },
      { id: 'y', digits: '1234' },
    ]);
    expect(hits).toEqual([
      { id: 'x', position: 10 },
      { id: 'y', position: 12 },
    ]);
  });

  it('没命中就返回空数组', () => {
    expect(findOccurrencesInText('0123', 1, [{ id: 'a', digits: '999' }])).toEqual([]);
  });
});

describe('CoverageTracker', () => {
  it('合并相邻区间并给出连续水位', () => {
    const tracker = new CoverageTracker();
    tracker.add(1, 10);
    tracker.add(11, 20);
    expect(tracker.contiguousThrough(1)).toBe(20);
    tracker.add(30, 40);
    expect(tracker.contiguousThrough(1)).toBe(20);
    expect(tracker.contiguousThrough(30)).toBe(40);
    expect(tracker.list().length).toBe(2);
  });

  it('乱序到达也能合上水位', () => {
    const tracker = new CoverageTracker();
    tracker.add(11, 20);
    expect(tracker.contiguousThrough(1)).toBe(0);
    tracker.add(1, 10);
    expect(tracker.contiguousThrough(1)).toBe(20);
  });

  it('重叠区间不重复计数', () => {
    const tracker = new CoverageTracker();
    tracker.add(1, 10);
    tracker.add(5, 15);
    expect(tracker.contiguousThrough(1)).toBe(15);
    expect(tracker.list()).toEqual([[1, 15]]);
  });
});

describe('分块规划', () => {
  it('阶梯块尺寸与钳制', () => {
    expect(CHUNK_LADDER).toEqual([64_000, 512_000, 1_000_000, 4_000_000]);
    expect(chunkSizeAt(0)).toBe(64_000);
    expect(chunkSizeAt(1)).toBe(512_000);
    expect(chunkSizeAt(2)).toBe(1_000_000);
    expect(chunkSizeAt(3)).toBe(4_000_000);
    expect(chunkSizeAt(99)).toBe(4_000_000);
  });

  it('向前多取串长-1 位做跨块重叠', () => {
    const plan = planChunk({ ownStart: 1, index: 0, needleLen: 8, targetDigits: 1_000_000, availableDigits: 1_000_000_000 });
    expect(plan).toEqual({
      index: 0,
      ownStart: 1,
      ownEnd: 64_000,
      fetchStart: 1,
      fetchCount: 64_007,
      nextStart: 64_001,
    });
  });

  it('目标与数据源尽头都会截断', () => {
    const target = planChunk({ ownStart: 1, index: 0, needleLen: 8, targetDigits: 100, availableDigits: 1_000_000_000 });
    expect(target?.ownEnd).toBe(100);
    expect(target?.fetchCount).toBe(107);
    expect(target?.nextStart).toBe(101);

    const source = planChunk({ ownStart: 1, index: 0, needleLen: 8, targetDigits: 1000, availableDigits: 50 });
    expect(source?.fetchCount).toBe(50);
  });

  it('超出数据源返回 null', () => {
    expect(planChunk({ ownStart: 100, index: 0, needleLen: 8, targetDigits: 1000, availableDigits: 50 })).toBeNull();
  });
});

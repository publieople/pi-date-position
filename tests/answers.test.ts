import { afterEach, describe, expect, it } from 'vitest';
import {
  ANSWER_SLOT_IDS,
  ANSWERS_VERSION,
  composeView,
  dayIndexOf,
  daysInYear,
  findDateAnswers,
  isLeapYear,
  loadYearTable,
  lookupAnswers,
  mergeAnswers,
  parseManifest,
  parseYearAnswers,
  resetAnswersCache,
  type AnswersManifest,
  type YearAnswers,
} from '../src/lib/answers';
import { encodingsFor } from '../src/lib/encodings';
import type { NeedleState, ScanSnapshot } from '../src/lib/searchEngine';

afterEach(() => {
  resetAnswersCache();
});

type Row = Array<[number, number] | null>;

const emptyDays = (year: number): Row[] =>
  Array.from({ length: daysInYear(year) }, () => [null, null, null, null, null, null] as Row);

const manifestOf = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: ANSWERS_VERSION,
  generatedAt: '2026-10-15T00:00:00.000Z',
  depth: 1_000_000_000,
  scannedThrough: 1_000_000_000,
  fromYear: 1900,
  toYear: 2100,
  slots: [...ANSWER_SLOT_IDS],
  labels: ['YYYYMMDD', 'MMDD', 'DDMM', 'YYMMDD', 'MMDDYYYY', 'DDMMYYYY'],
  years: [1900, 2026, 2100],
  needles: 228411,
  missing: 6,
  fields: ['position', 'count'],
  source: 'https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt',
  note: '',
  ...over,
});

const yearFileOf = (year: number, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  year,
  depth: 1_000_000_000,
  slots: [...ANSWER_SLOT_IDS],
  labels: ['YYYYMMDD', 'MMDD', 'DDMM', 'YYMMDD', 'MMDDYYYY', 'DDMMYYYY'],
  days: emptyDays(year),
  ...over,
});

const rowOf = (entries: Partial<Record<string, [number, number]>>): Row =>
  ANSWER_SLOT_IDS.map((id) => entries[id] ?? null);

describe('答案表：日期算术', () => {
  it('闰年判定与天数', () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
  });

  it('年积日（0-based）', () => {
    expect(dayIndexOf(2026, 1, 1)).toBe(0);
    expect(dayIndexOf(2026, 12, 31)).toBe(364);
    expect(dayIndexOf(2028, 12, 31)).toBe(365);
    expect(dayIndexOf(2028, 2, 29)).toBe(59);
    expect(dayIndexOf(2028, 3, 1)).toBe(60);
  });

  it('非法日期返回 -1', () => {
    expect(dayIndexOf(2026, 2, 29)).toBe(-1);
    expect(dayIndexOf(2026, 0, 1)).toBe(-1);
    expect(dayIndexOf(2026, 13, 1)).toBe(-1);
    expect(dayIndexOf(2026, 4, 31)).toBe(-1);
    expect(dayIndexOf(2026, 1, 0)).toBe(-1);
    expect(dayIndexOf(2026, 1, 1.5)).toBe(-1);
  });
});

describe('答案表：manifest 校验', () => {
  it('正常 manifest', () => {
    const manifest = parseManifest(manifestOf());
    expect(manifest.version).toBe(ANSWERS_VERSION);
    expect(manifest.depth).toBe(1_000_000_000);
    expect(manifest.slots).toEqual([...ANSWER_SLOT_IDS]);
  });

  it('版本不认识就拒掉', () => {
    expect(() => parseManifest(manifestOf({ version: 2 }))).toThrow(/版本/);
  });

  it('旧格式（没有次数）拒掉', () => {
    expect(() => parseManifest(manifestOf({ fields: ['position'] }))).toThrow(/旧格式/);
    expect(() => parseManifest(manifestOf({ fields: undefined }))).toThrow(/旧格式/);
  });

  it('槽位顺序不对就拒掉', () => {
    expect(() => parseManifest(manifestOf({ slots: [...ANSWER_SLOT_IDS].reverse() }))).toThrow(/槽位/);
  });

  it('不是对象就拒掉', () => {
    expect(() => parseManifest('nope')).toThrow(/不是对象/);
    expect(() => parseManifest([])).toThrow(/不是对象/);
  });
});

describe('答案表：年份文件校验', () => {
  it('闰年 366 天、平年 365 天', () => {
    expect(parseYearAnswers(yearFileOf(2028), 2028).days).toHaveLength(366);
    expect(parseYearAnswers(yearFileOf(2026), 2026).days).toHaveLength(365);
  });

  it('年份对不上就拒掉', () => {
    expect(() => parseYearAnswers(yearFileOf(2026), 2028)).toThrow(/年份文件对不上/);
  });

  it('天数不对就拒掉', () => {
    expect(() => parseYearAnswers(yearFileOf(2026, { days: [] }), 2026)).toThrow(/应该有 365 天/);
  });

  it('格子格式不对就拒掉', () => {
    const days = emptyDays(2026) as unknown as unknown[];
    days[3] = [null, null, null, null, null, [1, 2, 3]];
    expect(() => parseYearAnswers(yearFileOf(2026, { days }), 2026)).toThrow(/不是 \[位次, 次数\]/);
  });

  it('位次超出深度就拒掉', () => {
    const days = emptyDays(2026);
    days[0] = [[1001, 1], null, null, null, null, null];
    expect(() => parseYearAnswers(yearFileOf(2026, { depth: 1000, days }), 2026)).toThrow(/超出深度/);
  });
});

describe('答案表：对日期取答案', () => {
  it('按 ANSWER_SLOT_IDS 顺序对齐六个槽位，数字串来自 encodingsFor', () => {
    const days = emptyDays(2026);
    days[dayIndexOf(2026, 10, 14)] = rowOf({
      yyyymmdd: [13_634_723, 2],
      mmdd: [2_780, 9],
      ddmmyyyy: [404_161_577, 1],
    });
    const table = parseYearAnswers(yearFileOf(2026, { days }), 2026);
    const answers = findDateAnswers(table, 2026, 10, 14);
    expect(answers).not.toBeNull();
    expect(answers?.slots.map((slot) => slot.id)).toEqual([...ANSWER_SLOT_IDS]);
    expect(answers?.depth).toBe(1_000_000_000);
    const byId = new Map(answers!.slots.map((slot) => [slot.id, slot]));
    expect(byId.get('yyyymmdd')?.position).toBe(13_634_723);
    expect(byId.get('yyyymmdd')?.count).toBe(2);
    expect(byId.get('ddmmyyyy')?.position).toBe(404_161_577);
    // 数字串必须与页面自己算出来的一致（单一事实来源）
    for (const encoding of encodingsFor(new Date(2026, 9, 14, 12))) {
      if (encoding.group !== 'primary') continue;
      expect(byId.get(encoding.id)?.digits).toBe(encoding.digits);
      expect(byId.get(encoding.id)?.label).toBe(encoding.label);
    }
  });

  it('深度内没出现的格子给 position null / count 0', () => {
    const table = parseYearAnswers(yearFileOf(2026), 2026);
    const answers = findDateAnswers(table, 2026, 3, 5);
    expect(answers?.slots.every((slot) => slot.position === null && slot.count === 0)).toBe(true);
  });

  it('非法日期返回 null', () => {
    const table = parseYearAnswers(yearFileOf(2026), 2026);
    expect(findDateAnswers(table, 2026, 2, 29)).toBeNull();
    expect(findDateAnswers(table, 2026, 13, 1)).toBeNull();
  });
});

describe('答案表：合并进扫描快照', () => {
  const needleOf = (digits: string, over: Partial<NeedleState> = {}): NeedleState => ({
    id: digits,
    digits,
    length: digits.length,
    firstHit: null,
    firstHitConfirmed: false,
    occurrences: 0,
    occurrencesConfirmed: 0,
    status: 'searching',
    ...over,
  });

  const answersOf = (slots: Array<[string, string, number | null, number]>) => ({
    year: 2026,
    month: 10,
    day: 14,
    depth: 1_000_000_000,
    slots: slots.map(([id, digits, position, count]) => ({ id, label: id, digits, position, count })),
  });

  it('表里有的写法以表为准（位次、次数、已确认、深度）', () => {
    const merged = mergeAnswers(
      [needleOf('20261014', { firstHit: 999, firstHitConfirmed: true, occurrences: 1, status: 'found' })],
      answersOf([['yyyymmdd', '20261014', 13_634_723, 2]]),
    );
    const needle = merged.find((item) => item.digits === '20261014')!;
    expect(needle.firstHit).toBe(13_634_723);
    expect(needle.occurrences).toBe(2);
    expect(needle.occurrencesConfirmed).toBe(2);
    expect(needle.firstHitConfirmed).toBe(true);
    expect(needle.status).toBe('found');
    expect(needle.origin).toBe('table');
    expect(needle.knownThrough).toBe(1_000_000_000);
  });

  it('表说没出现、实时扫描却找到：以实时扫描为准', () => {
    const merged = mergeAnswers(
      [needleOf('0101', { firstHit: 8, firstHitConfirmed: true, occurrences: 3, status: 'found' })],
      answersOf([['mmdd', '0101', null, 0]]),
    );
    const needle = merged.find((item) => item.digits === '0101')!;
    expect(needle.firstHit).toBe(8);
    expect(needle.origin).toBeUndefined();
  });

  it('表说没出现、扫描也没找到：标成已确认的 not-found', () => {
    const merged = mergeAnswers([needleOf('0101')], answersOf([['mmdd', '0101', null, 0]]));
    const needle = merged.find((item) => item.digits === '0101')!;
    expect(needle.status).toBe('not-found');
    expect(needle.firstHit).toBeNull();
    expect(needle.firstHitConfirmed).toBe(true);
    expect(needle.origin).toBe('table');
  });

  it('表里没有的写法原样保留，快照里没有的槽位补上', () => {
    const merged = mergeAnswers(
      [needleOf('999999', { firstHit: 762, firstHitConfirmed: true, occurrences: 1, status: 'found' })],
      answersOf([['mmdd', '0101', 2_780, 9]]),
    );
    expect(merged).toHaveLength(2);
    const probe = merged.find((item) => item.digits === '999999')!;
    expect(probe.firstHit).toBe(762);
    expect(probe.origin).toBeUndefined();
    const added = merged.find((item) => item.digits === '0101')!;
    expect(added.firstHit).toBe(2_780);
    expect(added.origin).toBe('table');
    expect(added.status).toBe('found');
  });
});

describe('答案表：取数（注入 fetch）', () => {
  const okResponse = (value: unknown) =>
    ({ ok: true, status: 200, json: async () => value }) as unknown as Response;

  const collect = (calls: string[], over: (url: string) => Response) =>
    (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return over(url);
    }) as unknown as typeof fetch;

  it('先取 manifest 再取年份文件，已经取过的就复用缓存', async () => {
    const calls: string[] = [];
    const fetchImpl = collect(calls, (url) => {
      if (url.endsWith('manifest.json')) return okResponse(manifestOf());
      if (url.includes('2026.json')) return okResponse(yearFileOf(2026));
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    });

    const options = { base: 'https://example.test/answers/', fetchImpl };
    const answers = await lookupAnswers(2026, 10, 14, options);
    expect(answers).not.toBeNull();
    await loadYearTable(2026, options);
    await lookupAnswers(2026, 1, 1, options);

    const manifests = calls.filter((url) => url.endsWith('manifest.json'));
    const years = calls.filter((url) => url.includes('2026.json'));
    expect(manifests).toHaveLength(1);
    expect(years).toHaveLength(1);
    // 版本号来自 generatedAt，避免被旧的 CDN 缓存绊住
    expect(years[0]).toContain('v=' + encodeURIComponent('2026-10-15T00:00:00.000Z'));
  });

  it('年份超出表覆盖范围就抛错（调用方降级）', async () => {
    const fetchImpl = collect([], (url) =>
      url.endsWith('manifest.json') ? okResponse(manifestOf()) : okResponse(yearFileOf(1980)),
    );
    await expect(lookupAnswers(1980, 1, 1, { base: 'https://example.test/answers/', fetchImpl })).rejects.toThrow(
      /只覆盖/,
    );
  });

  it('失败不留坏缓存：下一次会重新取', async () => {
    let yearCalls = 0;
    const fetchImpl = collect([], (url) => {
      if (url.endsWith('manifest.json')) return okResponse(manifestOf());
      yearCalls += 1;
      if (yearCalls === 1) throw new Error('网络抖了一下');
      return okResponse(yearFileOf(2026));
    });
    const options = { base: 'https://example.test/answers/', fetchImpl };
    await expect(loadYearTable(2026, options)).rejects.toThrow(/网络抖了一下/);
    await expect(loadYearTable(2026, options)).resolves.toBeTruthy();
    expect(yearCalls).toBe(2);
  });

  it('HTTP 200 之外的响应算失败', async () => {
    const fetchImpl = collect([], () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response);
    await expect(loadYearTable(2026, { base: 'https://example.test/answers/', fetchImpl })).rejects.toThrow(/HTTP 500/);
  });
});

describe('答案表：产物对齐（表未重新生成时跳过）', () => {
  it('public/answers 与页面口径一致，且 2026-10-14 的位次与实测一致', async () => {
    const { readFile } = await import('node:fs/promises');
    let manifestRaw: string;
    try {
      manifestRaw = await readFile(new URL('../public/answers/manifest.json', import.meta.url), 'utf8');
    } catch {
      return; // 表还没生成（比如刚 clone）就跳过
    }
    if (!manifestRaw.includes('"count"')) return; // 还是只有位次的旧格式，等 pnpm answers 重新生成

    const manifest: AnswersManifest = parseManifest(JSON.parse(manifestRaw));
    expect(manifest.version).toBe(ANSWERS_VERSION);
    expect(manifest.slots).toEqual([...ANSWER_SLOT_IDS]);
    expect(manifest.fields).toContain('count');
    expect(manifest.years.length).toBeGreaterThan(100);

    let yearRaw: string;
    try {
      yearRaw = await readFile(new URL('../public/answers/2026.json', import.meta.url), 'utf8');
    } catch {
      return;
    }
    const table: YearAnswers = parseYearAnswers(JSON.parse(yearRaw), 2026);
    expect(table.days).toHaveLength(365);
    const answers = findDateAnswers(table, 2026, 10, 14);
    expect(answers?.slots).toHaveLength(6);
    const byId = new Map(answers!.slots.map((slot) => [slot.id, slot.position]));
    // 与 OpenViking 里记录的 2026-10-14 实测结果一致（独立佐证扫描没错）
    expect(byId.get('yyyymmdd')).toBe(13_634_723);
    expect(byId.get('mmdd')).toBe(2_780);
    expect(byId.get('ddmm')).toBe(7_766);
    expect(byId.get('yymmdd')).toBe(58_527);
    expect(byId.get('mmddyyyy')).toBe(87_405_522);
    expect(byId.get('ddmmyyyy')).toBe(404_161_577);
    for (const slot of answers!.slots) {
      if (slot.position === null) continue;
      expect(slot.position).toBeGreaterThanOrEqual(1);
      expect(slot.position).toBeLessThanOrEqual(manifest.depth);
      expect(slot.count).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('答案表：合成页面视图（composeView）', () => {
  const stateOf = (digits: string, over: Partial<NeedleState> = {}): NeedleState => ({
    id: digits,
    digits,
    length: digits.length,
    firstHit: null,
    firstHitConfirmed: false,
    occurrences: 0,
    occurrencesConfirmed: 0,
    status: 'searching',
    ...over,
  });

  const tableOf = (slots: Array<[string, string, number | null, number]>, depth = 1_000_000_000) => ({
    year: 2026,
    month: 10,
    day: 14,
    depth,
    slots: slots.map(([id, digits, position, count]) => ({ id, label: id, digits, position, count })),
  });

  const scanOf = (over: Partial<ScanSnapshot> = {}): ScanSnapshot => ({
    phase: 'searching',
    scannedDigits: 64_000,
    checkedDigits: 63_992,
    targetDigits: 10_000_000,
    availableDigits: 1_000_000_000,
    bytesFetched: 64_000,
    chunksDone: 1,
    elapsedMs: 120,
    etaMs: 30_000,
    gaps: [[10, 20]],
    needles: [],
    ...over,
  });

  it('没有表时原样返回扫描快照（同一个对象）', () => {
    const snapshot = scanOf();
    expect(composeView(snapshot, null, 10_000_000)).toBe(snapshot);
    expect(composeView(null, null, 10_000_000)).toBeNull();
  });

  it('扫描还没出第一帧时用空快照垫底，深度取表与目标的较大者', () => {
    const view = composeView(null, tableOf([['mmdd', '1014', 2_780, 9]], 1_000_000), 10_000_000)!;
    expect(view.phase).toBe('searching');
    expect(view.scannedDigits).toBe(0);
    expect(view.targetDigits).toBe(10_000_000);
    expect(view.availableDigits).toBe(10_000_000);
    expect(view.gaps).toEqual([]);
    expect(view.needles).toHaveLength(1);
    expect(view.needles[0].firstHit).toBe(2_780);
    expect(view.needles[0].origin).toBe('table');
  });

  it('进度类字段完全来自实时扫描，只有 needle 结论换成表', () => {
    const snapshot = scanOf({
      phase: 'done',
      needles: [stateOf('20261014', { firstHit: 999, firstHitConfirmed: true, occurrences: 1, status: 'found' })],
    });
    const view = composeView(snapshot, tableOf([['yyyymmdd', '20261014', 13_634_723, 2]]), 10_000_000)!;
    expect(view.phase).toBe('done');
    expect(view.scannedDigits).toBe(64_000);
    expect(view.checkedDigits).toBe(63_992);
    expect(view.targetDigits).toBe(10_000_000);
    expect(view.gaps).toEqual([[10, 20]]);
    expect(view.elapsedMs).toBe(120);
    const needle = view.needles[0];
    expect(needle.firstHit).toBe(13_634_723);
    expect(needle.occurrences).toBe(2);
    expect(needle.origin).toBe('table');
    expect(needle.knownThrough).toBe(1_000_000_000);
    // 原快照不被改写
    expect(snapshot.needles[0].firstHit).toBe(999);
  });
});


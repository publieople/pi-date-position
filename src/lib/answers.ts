// 离线预计算答案表（public/answers/*.json）的读取与合并。
//
// 为什么需要它：π 是固定的，而查询空间只是「日期」——1900–2100 年每天六种写法一共
// 二十多万个数字串，完全可以离线扫一遍十亿位、存成静态表。这样 GitHub Pages 上的静态站
// （没有本机服务、只能读同源文件、原来最多 100 万位）也能给出十亿位深度的答案；
// 浏览器里的实时扫描就退居「亲眼再验证一遍」。
//
// 口径与页面一致：位次是「小数点后第 k 位」（1-based），次数是完整落在前 depth 位内的
// 出现次数（允许重叠）；两者都只在这个深度内成立，超出深度不做任何断言。
import { encodingsFor, type Encoding } from './encodings';
import type { NeedleState, ScanSnapshot } from './searchEngine';

/** 答案表版本；表格式改了就加一，旧表会被 parseManifest 拒掉。 */
export const ANSWERS_VERSION = 1;

/** 年份文件里六个槽位的顺序，必须与 scripts/answers.mjs 的 SLOT_KEYS / encodingsFor 的主槽位一致。 */
export const ANSWER_SLOT_IDS = ['yyyymmdd', 'mmdd', 'ddmm', 'yymmdd', 'mmddyyyy', 'ddmmyyyy'] as const;

/** 页面可选日期的范围 = 离线答案表覆盖的范围（与 scripts/answers.mjs 的默认 --from-year / --to-year 一致）。 */
export const ANSWER_RANGE = {
  fromYear: 1900,
  toYear: 2100,
  minKey: '1900-01-01',
  maxKey: '2100-12-31',
} as const;

export interface AnswersManifest {
  version: number;
  generatedAt: string;
  /** 扫描深度（位）：表里的一切结论都只在这个范围内成立 */
  depth: number;
  scannedThrough: number;
  fromYear: number;
  toYear: number;
  slots: string[];
  labels: string[];
  years: number[];
  needles: number;
  missing: number;
  fields: string[];
  source: string;
  note: string;
}

/** 一格答案：[首次出现位次, 深度内出现次数] */
export type AnswerEntry = readonly [position: number, count: number];

export interface YearAnswers {
  year: number;
  depth: number;
  slots: string[];
  labels: string[];
  /** days[0] 是 1 月 1 日；每行六个槽位，顺序同 ANSWER_SLOT_IDS */
  days: Array<Array<AnswerEntry | null>>;
}

export interface SlotAnswer {
  id: string;
  label: string;
  digits: string;
  /** 深度内首次出现的位次；null = 深度内没出现过 */
  position: number | null;
  /** 深度内出现的次数；没出现过就是 0 */
  count: number;
}

export interface DateAnswers {
  year: number;
  month: number;
  day: number;
  depth: number;
  slots: SlotAnswer[];
}

// ---------------------------------------------------------------- 日期

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** 0-based 的年积日（1 月 1 日 = 0）；非法日期返回 -1 */
export function dayIndexOf(year: number, month: number, day: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return -1;
  if (month < 1 || month > 12) return -1;
  const limit = month === 2 && isLeapYear(year) ? 29 : MONTH_DAYS[month - 1];
  if (day < 1 || day > limit) return -1;
  let index = day - 1;
  for (let m = 0; m < month - 1; m++) {
    index += m === 1 && isLeapYear(year) ? 29 : MONTH_DAYS[m];
  }
  return index;
}

// ---------------------------------------------------------------- 解析（外部数据一律当 unknown 校验）

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(what + ' 不是对象');
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) throw new Error(what + ' 不是字符串数组');
  return value as string[];
}

function asPositiveInt(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) throw new Error(what + ' 不是正整数');
  return value;
}

function sameSlots(slots: string[]): boolean {
  return slots.length === ANSWER_SLOT_IDS.length && slots.every((slot, index) => slot === ANSWER_SLOT_IDS[index]);
}

export function parseManifest(raw: unknown): AnswersManifest {
  const record = asRecord(raw, '答案表 manifest');
  const version = asPositiveInt(record.version, 'manifest.version');
  if (version !== ANSWERS_VERSION) {
    throw new Error('答案表版本 ' + version + '，本页面只认识 ' + ANSWERS_VERSION + '（重新跑 pnpm answers 生成）');
  }
  const slots = asStringArray(record.slots, 'manifest.slots');
  if (!sameSlots(slots)) throw new Error('答案表槽位顺序不认识：' + slots.join(','));
  const labels = asStringArray(record.labels, 'manifest.labels');
  if (labels.length !== slots.length) throw new Error('manifest.labels 与 slots 数量不一致');
  const depth = asPositiveInt(record.depth, 'manifest.depth');
  const fields = asStringArray(record.fields ?? [], 'manifest.fields');
  if (!fields.includes('count')) {
    throw new Error('答案表是旧格式（只有位次、没有次数），重新跑 pnpm answers 生成');
  }
  if (!Array.isArray(record.years) || record.years.length === 0) throw new Error('manifest.years 不是年份数组');
  const years = record.years.map((item) => asPositiveInt(item, 'manifest.years 里的年份'));
  const scannedThrough = asPositiveInt(record.scannedThrough, 'manifest.scannedThrough');
  return {
    version,
    generatedAt: typeof record.generatedAt === 'string' ? record.generatedAt : '',
    depth,
    scannedThrough,
    fromYear: asPositiveInt(record.fromYear, 'manifest.fromYear'),
    toYear: asPositiveInt(record.toYear, 'manifest.toYear'),
    slots,
    labels,
    years,
    needles: asPositiveInt(record.needles, 'manifest.needles'),
    missing: typeof record.missing === 'number' ? record.missing : 0,
    fields,
    source: typeof record.source === 'string' ? record.source : '',
    note: typeof record.note === 'string' ? record.note : '',
  };
}

export function parseYearAnswers(raw: unknown, expectedYear: number): YearAnswers {
  const record = asRecord(raw, '年份文件');
  const year = asPositiveInt(record.year, 'year');
  if (year !== expectedYear) throw new Error('年份文件对不上：要 ' + expectedYear + ' 年，拿到 ' + year + ' 年');
  const depth = asPositiveInt(record.depth, 'depth');
  const slots = asStringArray(record.slots, 'slots');
  if (!sameSlots(slots)) throw new Error('年份文件槽位顺序不认识：' + slots.join(','));
  const labels = asStringArray(record.labels, 'labels');
  if (labels.length !== slots.length) throw new Error('labels 与 slots 数量不一致');
  if (!Array.isArray(record.days)) throw new Error('days 不是数组');
  const expectedDays = daysInYear(year);
  if (record.days.length !== expectedDays) {
    throw new Error(year + ' 年应该有 ' + expectedDays + ' 天，文件里是 ' + record.days.length + ' 天');
  }
  const days = record.days.map((row, index) => {
    if (!Array.isArray(row) || row.length !== slots.length) {
      throw new Error('第 ' + (index + 1) + ' 天的槽位数不是 ' + slots.length);
    }
    return row.map((cell, slot): AnswerEntry | null => {
      if (cell === null) return null;
      if (!Array.isArray(cell) || cell.length !== 2) {
        throw new Error('第 ' + (index + 1) + ' 天第 ' + (slot + 1) + ' 格不是 [位次, 次数]');
      }
      const position = asPositiveInt(cell[0], '位次');
      const count = asPositiveInt(cell[1], '次数');
      if (position > depth) throw new Error('第 ' + (index + 1) + ' 天的位次 ' + position + ' 超出深度 ' + depth);
      return [position, count] as const;
    });
  });
  return { year, depth, slots, labels, days };
}

// ---------------------------------------------------------------- 取表

/** 把某个日期的六种写法跟年份文件对上号；日期非法或没这一行就返回 null */
export function findDateAnswers(table: YearAnswers, year: number, month: number, day: number): DateAnswers | null {
  const index = dayIndexOf(year, month, day);
  if (index < 0 || index >= table.days.length) return null;
  const row = table.days[index];
  if (!row) return null;
  const byId = new Map<string, Encoding>();
  for (const encoding of encodingsFor(new Date(year, month - 1, day, 12))) {
    if (encoding.group === 'primary') byId.set(encoding.id, encoding);
  }
  const slots: SlotAnswer[] = [];
  for (let slot = 0; slot < ANSWER_SLOT_IDS.length; slot++) {
    const id = ANSWER_SLOT_IDS[slot];
    const encoding = byId.get(id);
    if (!encoding) continue;
    const entry = row[slot] ?? null;
    slots.push({
      id,
      label: encoding.label,
      digits: encoding.digits,
      position: entry === null ? null : entry[0],
      count: entry === null ? 0 : entry[1],
    });
  }
  if (slots.length === 0) return null;
  return { year, month, day, depth: table.depth, slots };
}

export interface AnswersLoadOptions {
  /** 答案表目录（默认按页面 base 解析到 answers/） */
  base?: string;
  fetchImpl?: typeof fetch;
}

function defaultBase(): string {
  const base = typeof document === 'undefined' ? import.meta.env.BASE_URL : document.baseURI;
  return new URL('answers/', new URL(base, 'http://localhost')).href;
}

let cachedBase: string | null = null;
let manifestPromise: Promise<AnswersManifest> | null = null;
const yearPromises = new Map<number, Promise<YearAnswers>>();

/** 换目录（比如测试里注入）就整体重来，避免拿到别处的表 */
function primeCache(base: string): void {
  if (cachedBase !== base) {
    cachedBase = base;
    manifestPromise = null;
    yearPromises.clear();
  }
}

export function resetAnswersCache(): void {
  cachedBase = null;
  manifestPromise = null;
  yearPromises.clear();
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error('取答案表失败：HTTP ' + response.status + ' ' + url);
  return (await response.json()) as unknown;
}

export function loadAnswersManifest(options: AnswersLoadOptions = {}): Promise<AnswersManifest> {
  const base = options.base ?? defaultBase();
  const fetchImpl = options.fetchImpl ?? fetch;
  primeCache(base);
  if (!manifestPromise) {
    const request = fetchJson(new URL('manifest.json', base).href, fetchImpl).then(parseManifest);
    manifestPromise = request;
    // 失败不留下坏缓存，下次还能重试
    request.catch(() => {
      if (manifestPromise === request) manifestPromise = null;
    });
  }
  return manifestPromise;
}

export function loadYearTable(year: number, options: AnswersLoadOptions = {}): Promise<YearAnswers> {
  const base = options.base ?? defaultBase();
  const fetchImpl = options.fetchImpl ?? fetch;
  primeCache(base);
  const cached = yearPromises.get(year);
  if (cached) return cached;
  const request = loadAnswersManifest({ base, fetchImpl }).then(async (manifest) => {
    if (!manifest.years.includes(year)) {
      throw new Error('答案表只覆盖 ' + manifest.fromYear + '–' + manifest.toYear + ' 年，没有 ' + year + ' 年');
    }
    // 带上生成时间做版本号：表重新生成后不会被旧的 CDN / 浏览器缓存绊住
    const url = new URL(year + '.json?v=' + encodeURIComponent(manifest.generatedAt), base).href;
    return parseYearAnswers(await fetchJson(url, fetchImpl), year);
  });
  request.catch(() => {
    if (yearPromises.get(year) === request) yearPromises.delete(year);
  });
  yearPromises.set(year, request);
  return request;
}

/** 某一天六种写法的表答案；表不可用（没生成、格式变了、网络失败）时抛错，调用方自己降级。 */
export async function lookupAnswers(
  year: number,
  month: number,
  day: number,
  options: AnswersLoadOptions = {}
): Promise<DateAnswers | null> {
  const table = await loadYearTable(year, options);
  return findDateAnswers(table, year, month, day);
}

// ---------------------------------------------------------------- 合并进扫描快照

function stateFromSlot(slot: SlotAnswer, depth: number): NeedleState {
  return {
    id: slot.digits,
    digits: slot.digits,
    length: slot.digits.length,
    firstHit: slot.position,
    // 表里的结论是定论：要么在第 position 位首次出现，要么在深度内根本没出现
    firstHitConfirmed: true,
    occurrences: slot.count,
    occurrencesConfirmed: slot.count,
    status: slot.position === null ? 'not-found' : 'found',
    origin: 'table',
    knownThrough: depth,
  };
}

function mergeSlot(needle: NeedleState, slot: SlotAnswer, depth: number): NeedleState {
  if (slot.position === null) {
    // 表说「深度内没出现」，实时扫描却找到了：以实时扫描为准（表可能旧了）
    if (needle.firstHit !== null) return needle;
    return { ...needle, firstHitConfirmed: true, occurrences: 0, occurrencesConfirmed: 0, status: 'not-found', origin: 'table', knownThrough: depth };
  }
  return {
    ...needle,
    firstHit: slot.position,
    firstHitConfirmed: true,
    // 次数只认表里的：它覆盖整个深度，而实时扫描的计数只到当前水位
    occurrences: slot.count,
    occurrencesConfirmed: slot.count,
    status: 'found',
    origin: 'table',
    knownThrough: depth,
  };
}

/**
 * 把表答案并进扫描快照的 needle 列表：同一个数字串以表为准（origin: 'table'），
 * 表里没有的数字串（比如探针、别的写法）保持原样，快照里还没有的槽位补上。
 * 进度类字段（已扫描位数、缺口、耗时…）完全不动 —— 那些描述的是实时扫描。
 */
export function mergeAnswers(needles: readonly NeedleState[], answers: DateAnswers): NeedleState[] {
  const byDigits = new Map<string, SlotAnswer>();
  for (const slot of answers.slots) byDigits.set(slot.digits, slot);
  const merged: NeedleState[] = [];
  const used = new Set<string>();
  for (const needle of needles) {
    const slot = byDigits.get(needle.digits);
    if (!slot) {
      merged.push(needle);
      continue;
    }
    used.add(needle.digits);
    merged.push(mergeSlot(needle, slot, answers.depth));
  }
  for (const slot of answers.slots) {
    if (used.has(slot.digits)) continue;
    merged.push(stateFromSlot(slot, answers.depth));
  }
  return merged;
}

/**
 * 合成页面用的视图快照：needle 结论以离线答案表为准，进度类字段保持实时扫描的语义。
 *
 * 表为空（还没取到、这一轮取表失败）时原样返回扫描快照；扫描还没出第一帧时用一份
 * 「正在搜索」的空快照垫底，好让表答案先单独撑住首屏。
 */
export function composeView(
  snapshot: ScanSnapshot | null,
  table: DateAnswers | null,
  targetDigits: number,
): ScanSnapshot | null {
  if (!table) return snapshot;
  const base: ScanSnapshot = snapshot ?? {
    phase: 'searching',
    scannedDigits: 0,
    checkedDigits: 0,
    targetDigits,
    availableDigits: Math.max(table.depth, targetDigits),
    bytesFetched: 0,
    chunksDone: 0,
    elapsedMs: 0,
    etaMs: null,
    gaps: [],
    needles: [],
  };
  return { ...base, needles: mergeAnswers(base.needles, table) };
}

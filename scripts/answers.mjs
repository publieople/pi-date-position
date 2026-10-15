// 预计算答案表：把一段年份里每一天六种写法在 π 里的**首次出现位次与出现次数**离线扫出来，
// 落到 public/answers/<年>.json。这样静态站（GitHub Pages，没有本机服务、只能读同源文件）
// 也能给出 10 亿位深度的答案，而不必在浏览器里重扫、也不会被 100 万位的降级数据掐住。
// 位次与次数都绑定在扫描深度上：只统计完整落在前 depth 位内的出现（允许重叠）。
//
// 口径与页面完全一致：位次是「小数点后第 k 位」，1-based；只在扫描深度内说「出现 / 未出现」。
// 扫描办法：一次顺序读完，对每个长度（4 / 6 / 8）各做一趟滑窗，O(位数)，不是每条串各 indexOf 一遍。
//
// 用法：
//   node scripts/answers.mjs --selftest
//       用 public/pi-1m.txt 的前 100 万位跟朴素 indexOf 对拍，验证扫描器本身没写错。
//   node scripts/answers.mjs
//       扫到 10 亿位，产出 public/answers/{manifest.json,1900.json,…,2100.json}。
//       为了统计次数，三类长度都要扫到底（不能「全找到就跳过」），十亿位约 10 分钟。
//   node scripts/answers.mjs --from-year 1900 --to-year 2100 --depth 1000000000 --concurrency 6
//   node scripts/answers.mjs --resume
//       从 .pi-cache/answers-state.json 的检查点接着扫（上游抖动时不至于从头再来）。
import { mkdirSync, writeFileSync, renameSync, readFileSync, existsSync, rmSync, openSync, readSync, closeSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const UPSTREAM = 'https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt';
/** 可查询的最大「小数点后位数」（与 server/pi-service.mjs 的 DECIMAL_DIGITS 一致） */
const MAX_DECIMAL_DIGITS = 1_000_000_000;
/** 一次取多少位（与服务端块大小一致，纯 I/O 粒度，不影响结果） */
const BLOCK_DIGITS = 4_000_000;
/** 年份文件里六个槽位的顺序（与 src/lib/encodings.ts 的 encodingsFor 一致） */
const SLOT_KEYS = ['yyyymmdd', 'mmdd', 'ddmm', 'yymmdd', 'mmddyyyy', 'ddmmyyyy'];
const SLOT_LABELS = ['YYYYMMDD', 'MMDD', 'DDMM', 'YYMMDD', 'MMDDYYYY', 'DDMMYYYY'];
const MANIFEST_VERSION = 1;

// ---------------------------------------------------------------- 参数

const arg = (name, fallback) => {
  const index = process.argv.indexOf('--' + name);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const has = (name) => process.argv.includes('--' + name);

const root = resolve(import.meta.dirname, '..');
const selftest = has('selftest');
const outDir = resolve(arg('out', join(root, 'public', 'answers')));
const statePath = resolve(arg('state', join(root, '.pi-cache', 'answers-state.json')));
const fromYear = Number(arg('from-year', 1900));
const toYear = Number(arg('to-year', 2100));
const depth = Math.min(Number(arg('depth', MAX_DECIMAL_DIGITS)), MAX_DECIMAL_DIGITS);
const concurrency = Math.max(1, Number(arg('concurrency', 6)));
const quiet = has('quiet');
const resume = has('resume');

if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear < 1 || toYear < fromYear) {
  throw new Error('--from-year / --to-year 需要合法年份，且 from <= to');
}
if (!Number.isInteger(depth) || depth < 1000) throw new Error('--depth 需要 >=1000 的整数');

// ---------------------------------------------------------------- 日期与数字串

const pad = (value, width) => String(value).padStart(width, '0');

/** 与 src/lib/encodings.ts 的 encodingsFor 同序：返回六种写法的数字串 */
function encodingsOf(year, month, day) {
  const YYYY = pad(year, 4);
  const MM = pad(month, 2);
  const DD = pad(day, 2);
  const YY = YYYY.slice(-2);
  return [YYYY + MM + DD, MM + DD, DD + MM, YY + MM + DD, MM + DD + YYYY, DD + MM + YYYY];
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 一年里的第几天（1 月 1 日 = 0），用于年份文件里的下标 */
function dayOfYear(year, month, day) {
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000);
}

// ---------------------------------------------------------------- 针（要搜的数字串）

function buildNeedles(yearsRange) {
  const indexOfDigits = new Map();
  const digitsByIndex = [];
  const register = (digits) => {
    let index = indexOfDigits.get(digits);
    if (index === undefined) {
      index = digitsByIndex.length;
      indexOfDigits.set(digits, index);
      digitsByIndex.push(digits);
    }
    return index;
  };
  const years = [];
  for (let year = yearsRange.from; year <= yearsRange.to; year++) {
    const months = [];
    for (let month = 1; month <= 12; month++) {
      const lastDay = daysInMonth(year, month);
      const days = [];
      for (let day = 1; day <= lastDay; day++) {
        const encodings = encodingsOf(year, month, day);
        days.push(encodings.map(register));
      }
      months.push(days);
    }
    years.push({ year, months });
  }
  return { years, digitsByIndex, indexOfDigits };
}

/**
 * 每个长度一张「数值 → 针下标」表：4 位、6 位用直接寻址数组，8 位用开放寻址哈希。
 * 定长数字串 ↔ 整数是一一对应的（前导零算进数值），所以可以用数值当 key。
 */
function buildLookups(digitsByIndex) {
  const byLength = new Map();
  for (let index = 0; index < digitsByIndex.length; index++) {
    const digits = digitsByIndex[index];
    const length = digits.length;
    if (!byLength.has(length)) byLength.set(length, []);
    byLength.get(length).push({ value: Number(digits), index });
  }
  const lookups = new Map();
  for (const [length, entries] of byLength) {
    if (length <= 6) {
      const table = new Uint32Array(10 ** length); // 存 下标 + 1，0 表示这里没有针
      for (const entry of entries) table[entry.value] = entry.index + 1;
      lookups.set(length, { kind: 'direct', table, count: entries.length });
    } else {
      let bits = 16;
      while (1 << bits < entries.length * 5) bits++;
      const mask = (1 << bits) - 1;
      const keys = new Int32Array(mask + 1).fill(-1);
      const values = new Int32Array(mask + 1).fill(-1);
      const spread = 2654435761;
      for (const entry of entries) {
        let slot = (Math.imul(entry.value, spread) >>> 0) & mask;
        while (values[slot] !== -1) slot = (slot + 1) & mask;
        keys[slot] = entry.value;
        values[slot] = entry.index;
      }
      lookups.set(length, { kind: 'hash', keys, values, mask, spread, count: entries.length });
    }
  }
  return lookups;
}

// ---------------------------------------------------------------- 扫描

/**
 * 顺序扫一段数字流，把每条针的**首次出现位次**（1-based）写进 positions（0 = 还没出现）。
 * fetchBlock(digitStart, digitCount) 返回这一段数字的 ASCII 字节（'0'-'9'）。
 */
async function scanRange({ fetchBlock, digitStart, digitCount, digitsByIndex, lookups, positions, counts, onProgress, onCheckpoint, carry = '' }) {
  let carryBytes = carry.length > 0 ? Buffer.from(carry, 'latin1') : Buffer.alloc(0);
  let scanned = digitStart - 1; // 已扫到的最后一位
  let fetched = 0;
  let nextStart = digitStart;
  const end = digitStart + digitCount - 1;

  // 每个长度还剩多少针没找到（只用于进度日志；计数模式下一趟都不能跳）
  const remaining = new Map();
  for (const length of lookups.keys()) {
    let left = 0;
    for (let index = 0; index < digitsByIndex.length; index++) {
      if (digitsByIndex[index].length === length && positions[index] === 0) left++;
    }
    remaining.set(length, left);
  }
  // 每个长度的针总数，进度日志里报「已找到 X / 总数 Y」
  const totals = new Map(remaining);

  /**
   * 三个长度各扫一趟合并缓冲：
   *  - 每次命中都给 counts 累加（深度内出现次数，与深度绑定）；
   *  - 位次只在 positions 还是 0 时落笔，所以先扫到的就是首次出现。
   *    因为要统计完整次数，三类都必须扫到底，不能「全找到就跳过」。
   */
  const scanBuffer = (combined, combinedStart) => {
    const size = combined.length;
    for (const [length, lookup] of lookups) {
      let found = 0;
      if (lookup.kind === 'direct') {
        const table = lookup.table;
        const modulus = 10 ** length;
        let value = 0;
        for (let i = 0; i < size; i++) {
          value = (value * 10 + (combined[i] - 48)) % modulus;
          if (i + 1 < length) continue;
          const slot = table[value];
          if (slot === 0) continue;
          const index = slot - 1;
          counts[index]++;
          if (positions[index] === 0) {
            positions[index] = combinedStart + (i - length + 1);
            found++;
          }
        }
      } else {
        const { keys, values, mask, spread } = lookup;
        let value = 0;
        const modulus = 10 ** length;
        for (let i = 0; i < size; i++) {
          value = (value * 10 + (combined[i] - 48)) % modulus;
          if (i + 1 < length) continue;
          let slot = (Math.imul(value, spread) >>> 0) & mask;
          for (;;) {
            const stored = values[slot];
            if (stored === -1) break;
            if (keys[slot] === value) {
              counts[stored]++;
              if (positions[stored] === 0) {
                positions[stored] = combinedStart + (i - length + 1);
                found++;
              }
              break;
            }
            slot = (slot + 1) & mask;
          }
        }
      }
      if (found > 0) remaining.set(length, Math.max(0, remaining.get(length) - found));
    }
  };

  while (nextStart <= end) {
    const count = Math.min(BLOCK_DIGITS, end - nextStart + 1);
    const bytes = await fetchBlock(nextStart, count);
    if (bytes.length !== count) throw new Error('取回的位数 ' + bytes.length + ' != 期望 ' + count);
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte < 48 || byte > 57) throw new Error('第 ' + (nextStart + i) + ' 位取回的不是数字：' + JSON.stringify(bytes[i]));
    }
    const combined = Buffer.allocUnsafe(carryBytes.length + bytes.length);
    carryBytes.copy(combined, 0);
    bytes.copy(combined, carryBytes.length);
    const combinedStart = nextStart - carryBytes.length;
    scanBuffer(combined, combinedStart);

    const maxKeep = Math.max(...lookups.keys()) - 1;
    carryBytes = combined.subarray(Math.max(0, combined.length - maxKeep));
    scanned = nextStart + count - 1;
    fetched += bytes.length;
    nextStart += count;
    onProgress?.({ scanned, fetched, remaining, totals });
    onCheckpoint?.({ scanned, carry: carryBytes.toString('latin1') });
  }
  return { scanned, fetched, carry: carryBytes.toString('latin1') };
}

// ---------------------------------------------------------------- 上游取数

/** 本机 π 服务缓存下来的块（.pi-cache/digits-*.bin）与上游文件字节一一对应，能读到就直接用，省一遍下载 */
const CACHE_DIR = resolve(arg('cache', join(root, '.pi-cache')));
const UPSTREAM_TOTAL_BYTES = 1_000_000_002;

function readCachedBlock(index) {
  const path = join(CACHE_DIR, 'digits-' + index + '.bin');
  const start = index * BLOCK_DIGITS;
  const length = Math.min((index + 1) * BLOCK_DIGITS, UPSTREAM_TOTAL_BYTES) - start;
  try {
    if (statSync(path).size !== length) return null;
    const buffer = Buffer.allocUnsafe(length);
    const fd = openSync(path, 'r');
    try {
      let read = 0;
      while (read < length) {
        const n = readSync(fd, buffer, read, length - read, read);
        if (n <= 0) return null;
        read += n;
      }
    } finally {
      closeSync(fd);
    }
    return buffer;
  } catch {
    return null;
  }
}

/** 读「第 start 位开始的 count 位」对应的上游字节：块内对齐时尽量命中本地缓存 */
function readFromCache(digitStart, digitCount) {
  const firstByte = digitStart + 1;
  const lastByte = firstByte + digitCount - 1;
  const firstBlock = Math.floor(firstByte / BLOCK_DIGITS);
  const lastBlock = Math.floor(lastByte / BLOCK_DIGITS);
  const parts = [];
  for (let index = firstBlock; index <= lastBlock; index++) {
    const bytes = readCachedBlock(index);
    if (!bytes) return null;
    const from = Math.max(0, firstByte - index * BLOCK_DIGITS);
    const to = Math.min(bytes.length - 1, lastByte - index * BLOCK_DIGITS);
    parts.push(bytes.subarray(from, to + 1));
  }
  const joined = parts.length === 1 ? parts[0] : Buffer.concat(parts);
  return joined.length === digitCount ? joined : null;
}

async function fetchUpstream(digitStart, digitCount, retries = 4) {
  // 位次 k 的数字在上游文件字节 k + 1（字节 0 是整数位 3，字节 1 是小数点）
  const startByte = digitStart + 1;
  const endByte = startByte + digitCount - 1;
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(UPSTREAM, {
        headers: { Range: 'bytes=' + startByte + '-' + endByte, 'User-Agent': 'pi-date-position/answers (+offline index build)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error('上游 HTTP ' + response.status);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * attempt * attempt));
    }
  }
  throw new Error('字节 ' + startByte + '-' + endByte + ' 取数失败：' + lastError?.message);
}

// ---------------------------------------------------------------- 产出

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = path + '.' + process.pid + '.tmp';
  writeFileSync(tmp, JSON.stringify(value));
  renameSync(tmp, path);
}

function writeYearFiles({ years, positions, counts, outDir }) {
  const written = [];
  for (const { year, months } of years) {
    const days = [];
    for (const daysOfMonth of months) {
      for (const encodings of daysOfMonth) {
        // 每格是 [首次出现位次, 深度内完整出现的次数]，深度内没出现过就是 null
        days.push(encodings.map((index) => (positions[index] === 0 ? null : [positions[index], counts[index]])));
      }
    }
    const path = join(outDir, year + '.json');
    writeJsonAtomic(path, { year, depth, slots: SLOT_KEYS, labels: SLOT_LABELS, days });
    written.push(path);
  }
  return written;
}

// ---------------------------------------------------------------- 自检：与朴素实现对拍

/** 朴素计数：逐位 indexOf，允许重叠（与滑窗扫过的每个窗口一一对应） */
function countOccurrences(text, needle) {
  let count = 0;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) count++;
  return count;
}

async function runSelftest() {
  const fallbackPath = join(root, 'public', 'pi-1m.txt');
  if (!existsSync(fallbackPath)) throw new Error('缺少 ' + fallbackPath + '，先跑 pnpm fetch-fallback');
  const text = readFileSync(fallbackPath, 'latin1').replace(/[^0-9]/g, '');
  const testDepth = Math.min(text.length, 1_000_000);
  console.log('对拍：' + fallbackPath + ' 前 ' + testDepth.toLocaleString('en-US') + ' 位，朴素 indexOf vs 滑窗扫描');

  const range = { from: 2026, to: 2028 };
  const { years, digitsByIndex } = buildNeedles(range);
  const lookups = buildLookups(digitsByIndex);
  const positions = new Uint32Array(digitsByIndex.length);
  const counts = new Int32Array(digitsByIndex.length);
  const fetchBlock = async (digitStart, digitCount) => {
    if (digitStart + digitCount - 1 > testDepth) throw new Error('超出对拍数据范围');
    return Buffer.from(text.slice(digitStart - 1, digitStart - 1 + digitCount), 'latin1');
  };
  await scanRange({ fetchBlock, digitStart: 1, digitCount: testDepth, digitsByIndex, lookups, positions, counts });

  let checked = 0;
  let mismatches = 0;
  for (let index = 0; index < digitsByIndex.length; index++) {
    const digits = digitsByIndex[index];
    const at = text.slice(0, testDepth).indexOf(digits);
    const expected = at === -1 ? 0 : at + 1;
    checked++;
    if (positions[index] !== expected) {
      mismatches++;
      if (mismatches <= 10) console.log('  ❌ ' + digits + ' 滑窗=' + positions[index] + ' 朴素=' + expected);
    }
  }
  // 年份文件的槽位也要对得上：连带闰日与年末，比对 days[doy][slot] 与朴素结果
  writeYearFiles({ years, positions, counts, outDir: join(root, '.pi-cache', 'answers-selftest') });
  const tables = new Map(
    years.map(({ year }) => [year, JSON.parse(readFileSync(join(root, '.pi-cache', 'answers-selftest', year + '.json'), 'utf8'))])
  );
  const sample = [[2026, 1, 1], [2026, 2, 28], [2026, 7, 4], [2026, 12, 31], [2028, 2, 29], [2028, 12, 31]];
  for (const [year, month, day] of sample) {
    const table = tables.get(year);
    const doy = dayOfYear(year, month, day);
    if (table.days.length !== (year % 4 === 0 ? 366 : 365)) {
      mismatches++;
      console.log('  ❌ ' + year + ' 年份文件天数 ' + table.days.length + ' 不对');
    }
    encodingsOf(year, month, day).forEach((digits, slot) => {
      const at = text.slice(0, testDepth).indexOf(digits);
      const expected = at === -1 ? null : at + 1;
      const expectedCount = countOccurrences(text.slice(0, testDepth), digits);
      const entry = table.days[doy][slot];
      const gotPosition = entry === null ? null : entry[0];
      const gotCount = entry === null ? 0 : entry[1];
      checked += 2;
      if (gotPosition !== expected) {
        mismatches++;
        console.log('  ❌ ' + year + '-' + pad(month, 2) + '-' + pad(day, 2) + ' ' + SLOT_KEYS[slot] + '(' + digits + ') 位次 表=' + gotPosition + ' 朴素=' + expected);
      }
      if (gotCount !== expectedCount) {
        mismatches++;
        console.log('  ❌ ' + year + '-' + pad(month, 2) + '-' + pad(day, 2) + ' ' + SLOT_KEYS[slot] + '(' + digits + ') 次数 表=' + gotCount + ' 朴素=' + expectedCount);
      }
    });
  }
  console.log('比对 ' + checked + ' 项，' + (mismatches === 0 ? '全部一致 ✅' : mismatches + ' 项不一致 ❌'));
  rmSync(join(root, '.pi-cache', 'answers-selftest'), { recursive: true, force: true });
  return mismatches === 0;
}

// ---------------------------------------------------------------- 主流程

async function main() {
  const { years, digitsByIndex } = buildNeedles({ from: fromYear, to: toYear });
  const lookups = buildLookups(digitsByIndex);
  const needleCount = digitsByIndex.length;
  const positions = new Uint32Array(needleCount);
  const counts = new Int32Array(needleCount);

  let startDigit = 1;
  let carry = '';
  if (resume && existsSync(statePath)) {
    const saved = JSON.parse(readFileSync(statePath, 'utf8'));
    if (saved.fromYear === fromYear && saved.toYear === toYear && saved.depth === depth && Array.isArray(saved.positions)) {
      saved.positions.forEach((value, index) => { if (index < needleCount) positions[index] = value; });
      if (Array.isArray(saved.counts)) saved.counts.forEach((value, index) => { if (index < needleCount) counts[index] = value; });
      startDigit = saved.scannedThrough + 1;
      carry = saved.carry ?? '';
      console.log('从检查点接着扫：已扫到第 ' + saved.scannedThrough.toLocaleString('en-US') + ' 位');
    } else {
      console.log('检查点与当前参数不符，忽略，从第 1 位开始');
    }
  }

  console.log(
    '年份 ' + fromYear + '–' + toYear + '，' + needleCount.toLocaleString('en-US') + ' 条数字串' +
      '（长度 ' + [...lookups.keys()].sort().join(' / ') + '），扫描上限 ' + depth.toLocaleString('en-US') + ' 位，并发 ' + concurrency
  );

  const startedAt = Date.now();
  let lastLog = 0;
  let lastCheckpoint = 0;
  // 检查点：上游抖动或中途挂掉时 --resume 能接着扫，不必从头再来
  const onCheckpoint = ({ scanned, carry: nextCarry }) => {
    if (Date.now() - lastCheckpoint < 60_000) return;
    lastCheckpoint = Date.now();
    writeJsonAtomic(statePath, {
      fromYear, toYear, depth, scannedThrough: scanned, carry: nextCarry, positions: [...positions], counts: [...counts],
    });
  };
  const onProgress = ({ scanned, fetched, remaining, totals }) => {
    if (quiet) return;
    const now = Date.now();
    if (scanned < depth && now - lastLog < 20_000) return;
    lastLog = now;
    const seconds = (now - startedAt) / 1000;
    const left = [...remaining.entries()]
      .map(([length, count]) => {
        const total = totals.get(length) ?? 0;
        return length + '位 ' + (total - count).toLocaleString('en-US') + '/' + total.toLocaleString('en-US');
      })
      .join('，');
    console.log(
      '  ' + (scanned / depth * 100).toFixed(1) + '%  第 ' + scanned.toLocaleString('en-US') + ' 位' +
        '  [' + (fetched / 1e6 / Math.max(seconds, 0.001)).toFixed(1) + ' MB/s, ' + seconds.toFixed(0) + 's]  ' + left
    );
  };

  // 下载与扫描重叠：始终预取后面 concurrency 块
  const cache = new Map();
  const inFlight = new Map();
  let fromCache = 0;
  const prefetch = (digitStart) => {
    if (digitStart > depth) return;
    if (cache.has(digitStart) || inFlight.has(digitStart)) return;
    const count = Math.min(BLOCK_DIGITS, depth - digitStart + 1);
    const promise = Promise.resolve()
      .then(() => {
        const cached = readFromCache(digitStart, count);
        if (cached) { fromCache++; return cached; }
        return fetchUpstream(digitStart, count);
      })
      .then(
      (bytes) => { cache.set(digitStart, bytes); inFlight.delete(digitStart); return bytes; },
      (error) => { inFlight.delete(digitStart); throw error; }
    );
    inFlight.set(digitStart, promise);
  };

  let next = startDigit;
  const fetchBlock = async (digitStart) => {
    for (let k = 0; k <= concurrency; k++) prefetch(next + k * BLOCK_DIGITS);
    const pending = inFlight.get(digitStart) ?? cache.get(digitStart);
    let bytes;
    if (pending instanceof Promise) bytes = await pending;
    else if (pending) bytes = pending;
    else { prefetch(digitStart); bytes = await inFlight.get(digitStart); }
    cache.delete(digitStart);
    next = digitStart + BLOCK_DIGITS;
    return bytes;
  };

  const result = await scanRange({
    fetchBlock,
    digitStart: startDigit,
    digitCount: depth - startDigit + 1,
    digitsByIndex,
    lookups,
    positions,
    counts,
    carry,
    onProgress,
    onCheckpoint,
  });

  const missing = [];
  for (let index = 0; index < needleCount; index++) if (positions[index] === 0) missing.push(digitsByIndex[index]);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  mkdirSync(outDir, { recursive: true });
  writeYearFiles({ years, positions, counts, outDir });
  writeJsonAtomic(join(outDir, 'manifest.json'), {
    version: MANIFEST_VERSION,
    generatedAt: new Date().toISOString(),
    depth,
    scannedThrough: result.scanned,
    fromYear,
    toYear,
    slots: SLOT_KEYS,
    labels: SLOT_LABELS,
    years: years.map((item) => item.year),
    needles: needleCount,
    missing: missing.length,
    fields: ['position', 'count'],
    source: UPSTREAM,
    note:
      '离线预计算索引：每格 [位次, 次数]。位次是「小数点后第 k 位」（1-based），次数是完整落在前 ' +
      depth.toLocaleString('en-US') +
      ' 位内的出现次数（允许重叠），两者都只在这个深度内成立；深度内没出现过就是 null。',
  });
  // 扫完就把检查点删掉，避免下次 --resume 误用
  rmSync(statePath, { force: true });

  console.log('\n用时 ' + seconds + ' 秒，扫完 ' + result.scanned.toLocaleString('en-US') + ' 位（' + fromCache + ' 块来自本机 .pi-cache）');
  console.log('已写出 ' + outDir + '（' + years.length + ' 个年份文件 + manifest.json）');
  if (missing.length > 0) {
    console.log('有 ' + missing.length + ' 条数字串在 ' + depth.toLocaleString('en-US') + ' 位内没有出现，年份文件里记作 null。');
    console.log('例如：' + missing.slice(0, 10).join(' '));
  } else {
    console.log('所有数字串都在深度内出现。');
  }

  // 顺带打印几个已知锚点，方便人眼复核
  const probe = (year, month, day, label) => {
    const encodings = encodingsOf(year, month, day);
    const line = encodings
      .map((digits, slot) => {
        const where = depths.get(digits);
        if (where === undefined || where === 0) return SLOT_LABELS[slot] + '=未出现';
        return SLOT_LABELS[slot] + '=' + where.toLocaleString('en-US') + '（' + occurrences.get(digits).toLocaleString('en-US') + ' 次）';
      })
      .join('  ');
    console.log('· ' + label + '（' + year + '-' + pad(month, 2) + '-' + pad(day, 2) + '）：' + line);
  };
  const depths = new Map();
  const occurrences = new Map();
  for (let index = 0; index < needleCount; index++) {
    depths.set(digitsByIndex[index], positions[index]);
    occurrences.set(digitsByIndex[index], counts[index]);
  }
  probe(2026, 10, 14, '今天');
  probe(2028, 2, 29, '闰日');
}

// 只有直接 node scripts/answers.mjs 时才执行 main；被 import 时不动作
const invokedDirectly = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  if (selftest) {
    const ok = await runSelftest();
    process.exitCode = ok ? 0 : 1;
  } else {
    await main();
  }
}

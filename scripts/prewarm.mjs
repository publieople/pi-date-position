// 深搜 + 预热：通过本机 π 服务的 /api/digits 顺序拉取数字（顺带把 .pi-cache 写满），
// 用滑窗找出「某天六种写法在 π 里首次出现在第几位」，最后用 api.pi.delivery 复核。
// 不导入应用代码，跟页面走的是同一套 HTTP 接口。
// 用法：node scripts/prewarm.mjs [--date 2026-10-14] [--depth 1000000000] [--base http://127.0.0.1:5273] [--concurrency 4]
const DEFAULT_BASE = 'http://127.0.0.1:5273';
const DEFAULT_DEPTH = 1_000_000_000;
const MAX_BLOCK = 4_000_000; // 与服务端一致：单次最多取 4,000,000 位（另有 16 位重叠余量）
/** 可查询的最大「小数点后位数」（与 server/pi-service.mjs 的 DECIMAL_DIGITS 一致） */
const DECIMAL_DIGITS = 1_000_000_000;

const arg = (name, fallback) => {
  const index = process.argv.indexOf('--' + name);
  return index > -1 ? process.argv[index + 1] : fallback;
};

const dateArg = arg('date', new Date().toISOString().slice(0, 10));
const depth = Number(arg('depth', DEFAULT_DEPTH));
const base = arg('base', DEFAULT_BASE);
const concurrency = Number(arg('concurrency', 4));
const [, y, m, d] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateArg) ?? [];
if (!y) throw new Error('--date 需要 YYYY-MM-DD，例如 --date 2026-10-14');
if (!Number.isFinite(depth) || depth < 1) throw new Error('--depth 需要正整数');

const YYYY = y;
const MM = m;
const DD = d;
const YY = YYYY.slice(-2);
const encodings = [
  ['YYYYMMDD', `${YYYY}${MM}${DD}`],
  ['MMDD', `${MM}${DD}`],
  ['DDMM', `${DD}${MM}`],
  ['YYMMDD', `${YY}${MM}${DD}`],
  ['MMDDYYYY', `${MM}${DD}${YYYY}`],
  ['DDMMYYYY', `${DD}${MM}${YYYY}`],
];

// 相同数字串只搜一次（MMDD 与 DDMM 在同一天会重合），但保留各自的标签
const byDigits = new Map();
for (const [label, digits] of encodings) {
  if (!byDigits.has(digits)) byDigits.set(digits, { digits, labels: [] });
  byDigits.get(digits).labels.push(label);
}
const needles = [...byDigits.values()].map((n) => ({ ...n, position: null }));
const maxLen = Math.max(...needles.map((n) => n.digits.length));
const blockSize = MAX_BLOCK;

async function fetchDigits(from, count) {
  const url = `${base}/api/digits?from=${from}&count=${count}`;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      if (text.length === 0) throw new Error('空响应');
      return text;
    } catch (error) {
      if (attempt >= 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

const startedAt = Date.now();
const totalBlocks = Math.ceil(depth / blockSize);
let nextBlock = 0;
let doneBlocks = 0;
let fetchedBytes = 0;
let stopped = false;
const gaps = [];

const foundCount = () => needles.filter((n) => n.position !== null).length;

async function worker() {
  for (;;) {
    if (stopped) return;
    const index = nextBlock++;
    if (index >= totalBlocks) return;
    const ownStart = index * blockSize + 1;
    const ownEnd = Math.min(ownStart + blockSize - 1, depth);
    const count = Math.min(ownEnd + maxLen - 1, DECIMAL_DIGITS) - ownStart + 1;
    let text;
    try {
      text = await fetchDigits(ownStart, count);
    } catch (error) {
      gaps.push(index);
      console.error(`  ! 块 ${index} 失败：${error.message}（已记为缺口）`);
      continue;
    }
    fetchedBytes += text.length;
    for (const needle of needles) {
      if (needle.position !== null) continue;
      const at = text.indexOf(needle.digits);
      if (at === -1) continue;
      const position = ownStart + at;
      if (position <= ownEnd) needle.position = position; // 重叠区里的命中归下一块
    }
    doneBlocks++;
    if (doneBlocks % 10 === 0 || foundCount() === needles.length) {
      const scanned = Math.min(doneBlocks * blockSize, depth);
      const seconds = (Date.now() - startedAt) / 1000;
      console.log(
        `已扫描 ${scanned.toLocaleString('en-US')} 位 — ${foundCount()}/${needles.length} 已找到` +
          `  [${(fetchedBytes / 1e6 / Math.max(seconds, 0.001)).toFixed(1)} MB/s, ${seconds.toFixed(0)}s]`
      );
      if (foundCount() === needles.length) stopped = true;
    }
  }
}

console.log(`日期 ${dateArg}，${needles.length} 条数字串，扫描上限 ${depth.toLocaleString('en-US')} 位（服务 ${base}，并发 ${concurrency}）\n`);
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n用时 ${seconds} 秒，取回 ${(fetchedBytes / 1e6).toFixed(1)} MB` + (gaps.length ? `，缺口块：${gaps.join(', ')}` : '，无缺口'));
console.log('');

for (const needle of needles) {
  const label = needle.labels.join(' / ');
  if (needle.position === null) {
    console.log(`· ${label} (${needle.digits})：${depth.toLocaleString('en-US')} 位内未出现`);
  } else {
    console.log(`· ${label} (${needle.digits})：第 ${needle.position.toLocaleString('en-US')} 位`);
  }
}

console.log('\n用 api.pi.delivery 复核：');
let failures = 0;
for (const needle of needles) {
  if (needle.position === null) continue;
  const url = `https://api.pi.delivery/v1/pi?start=${needle.position}&numberOfDigits=${needle.digits.length}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    const body = await res.json();
    const ok = body.content === needle.digits;
    if (!ok) failures++;
    console.log(`· ${needle.labels[0]} 第 ${needle.position} 位 → 返回 "${body.content}" ${ok ? '✅ 一致' : '❌ 不一致'}`);
  } catch (error) {
    failures++;
    console.log(`· ${needle.labels[0]} 第 ${needle.position} 位 → 复核失败：${error.message}`);
  }
}
if (gaps.length && foundCount() < needles.length) {
  console.log(`\n注意：有 ${gaps.length} 块失败，未找到的写法不能据此判定「不出现」。`);
}
process.exitCode = failures === 0 ? 0 : 1;

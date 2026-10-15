// π 位数本地服务：按块缓存 MIT 的 pi-billion.txt，并按「小数点后第 k 位」的坐标提供任意区间的数字。
// 零依赖，可被 vite.config.ts（dev / preview 中间件）与 scripts/serve.mjs（生产静态服务）复用。
import { mkdirSync, openSync, readSync, closeSync, statSync, renameSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const UPSTREAM_URL = 'https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt';
// MIT 文件实测 1_000_000_002 字节 = "3." + 10 亿位小数，无换行。
export const TOTAL_BYTES = 1_000_000_002;
/** 可查询的最大「小数点后位数」 */
export const DECIMAL_DIGITS = 1_000_000_000;
/** 一个缓存块包含的上游字节数（同时也是 /api/digits 单次 count 的基准上限） */
export const BLOCK_SIZE = 4_000_000;
export const BLOCK_COUNT = Math.ceil(TOTAL_BYTES / BLOCK_SIZE);
/** 前端深搜时每块会多取「最长数字串长度 - 1」位做跨块重叠，因此 count 允许比块大小再多这么多位 */
export const MAX_RANGE_OVERLAP = 16;

/** 「小数点后第 k 位（k>=1）」对应的上游文件字节偏移 */
export const byteOffsetOf = (position) => position + 1;

const DIGIT_OR_DOT = (buf) => {
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b !== 0x2e && (b < 0x30 || b > 0x39)) return false;
  }
  return true;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function createLimiter(max) {
  let active = 0;
  const queue = [];
  const pump = () => {
    while (active < max && queue.length > 0) {
      const job = queue.shift();
      active++;
      job.fn().then(
        (value) => { active--; job.resolve(value); pump(); },
        (error) => { active--; job.reject(error); pump(); }
      );
    }
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); pump(); });
}

function readSlice(file, offset, length) {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.allocUnsafe(length);
    let read = 0;
    while (read < length) {
      const n = readSync(fd, buf, read, length - read, offset + read);
      if (n <= 0) throw new Error('缓存文件读取不完整：' + file);
      read += n;
    }
    return buf;
  } finally {
    closeSync(fd);
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.projectRoot] 用于推导默认缓存目录
 * @param {string} [options.cacheDir]
 * @param {string} [options.upstream]
 * @param {number} [options.concurrency] 上游并发上限
 * @param {number} [options.retries]
 * @param {number} [options.timeoutMs]
 * @param {(msg: string) => void} [options.log]
 */
export function createPiService(options = {}) {
  const {
    projectRoot = process.cwd(),
    cacheDir = join(projectRoot, '.pi-cache'),
    upstream = UPSTREAM_URL,
    concurrency = 4,
    retries = 3,
    timeoutMs = 30_000,
    // 下面三项可在测试里改小，用来构造小规模的上游
    blockSize = BLOCK_SIZE,
    totalBytes = TOTAL_BYTES,
    decimalDigits = DECIMAL_DIGITS,
    log = () => {},
    fetchImpl = fetch,
  } = options;

  mkdirSync(cacheDir, { recursive: true });
  const limit = createLimiter(concurrency);
  // 防止同一个块被并发下载多次
  const inflight = new Map();
  let downloadedBytes = 0;
  let servedDigits = 0;
  let upstreamErrors = 0;

  const blockCount = Math.ceil(totalBytes / blockSize);
  const blockPath = (index) => join(cacheDir, 'digits-' + index + '.bin');
  const blockByteStart = (index) => index * blockSize;
  const blockByteEnd = (index) => Math.min(blockByteStart(index) + blockSize, totalBytes) - 1; // inclusive
  const blockLength = (index) => blockByteEnd(index) - blockByteStart(index) + 1;

  function isBlockCached(index) {
    const file = blockPath(index);
    try {
      return statSync(file).size === blockLength(index);
    } catch {
      return false;
    }
  }

  async function downloadBlock(index) {
    const start = blockByteStart(index);
    const end = blockByteEnd(index);
    const expected = end - start + 1;
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetchImpl(upstream, {
          headers: { Range: 'bytes=' + start + '-' + end, 'User-Agent': 'pi-date-position/0.1 (+local dev server)' },
          redirect: 'follow',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error('上游返回 HTTP ' + res.status);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length !== expected) throw new Error('上游返回长度 ' + buf.length + ' != 期望 ' + expected);
        if (!DIGIT_OR_DOT(buf)) throw new Error('上游返回内容含非数字字符（块 ' + index + '）');
        const tmp = blockPath(index) + '.' + process.pid + '.tmp';
        writeFileSync(tmp, buf);
        renameSync(tmp, blockPath(index)); // 原子落盘
        downloadedBytes += buf.length;
        log('已缓存块 ' + index + '（字节 ' + start + '-' + end + '，' + buf.length + 'B）');
        return;
      } catch (error) {
        lastError = error;
        upstreamErrors++;
        log('块 ' + index + ' 第 ' + attempt + '/' + retries + ' 次下载失败：' + error.message);
        if (attempt < retries) await sleep(400 * attempt * attempt);
      }
    }
    throw new Error('块 ' + index + ' 下载失败：' + (lastError && lastError.message));
  }

  function ensureBlock(index) {
    if (index < 0 || index >= blockCount) return Promise.reject(new RangeError('块索引越界：' + index));
    if (isBlockCached(index)) return Promise.resolve(blockPath(index));
    const pending = inflight.get(index);
    if (pending) return pending;
    const p = limit(() => downloadBlock(index)).finally(() => { inflight.delete(index); });
    inflight.set(index, p);
    return p;
  }

  /**
   * 取「小数点后第 from 位」开始的 count 位数字。
   * @param {number} from 1-based，与 /api/digits 的 from 同义
   * @param {number} count
   */
  async function getDigits(from, count) {
    if (!Number.isInteger(from) || from < 1) throw new RangeError('from 必须是 >=1 的整数');
    if (!Number.isInteger(count) || count < 1) throw new RangeError('count 必须是 >=1 的整数');
    if (from > decimalDigits) throw new RangeError('from 超出范围（最大 ' + decimalDigits + '）');
    const n = Math.min(count, decimalDigits - from + 1);
    const firstByte = byteOffsetOf(from);           // 含
    const lastByte = firstByte + n - 1;             // 含
    const firstBlock = Math.floor(firstByte / blockSize);
    const lastBlock = Math.floor(lastByte / blockSize);
    for (let i = firstBlock; i <= lastBlock; i++) await ensureBlock(i);
    const parts = [];
    for (let i = firstBlock; i <= lastBlock; i++) {
      const offsetInBlock = Math.max(0, firstByte - blockByteStart(i)); // 块内偏移
      const endInBlock = Math.min(blockLength(i) - 1, lastByte - blockByteStart(i));
      parts.push(readSlice(blockPath(i), offsetInBlock, endInBlock - offsetInBlock + 1));
    }
    servedDigits += n;
    return Buffer.concat(parts).toString('latin1');
  }

  function stats() {
    let cached = 0;
    let cachedBytes = 0;
    try {
      for (const name of readdirSync(cacheDir)) {
        const m = /^digits-(\d+)\.bin$/.exec(name);
        if (!m) continue;
        if (isBlockCached(Number(m[1]))) { cached++; cachedBytes += blockLength(Number(m[1])); }
      }
    } catch {}
    return {
      totalDigits: decimalDigits,
      totalBytes,
      blockSize,
      blockCount,
      cachedBlocks: cached,
      cachedBytes,
      blockBytes: blockSize,
      downloadedBytes,
      servedDigits,
      upstreamErrors,
      upstream,
      cacheDir,
      source: 'mit-pi-billion',
    };
  }

  function sendJson(res, status, body) {
    const text = JSON.stringify(body);
    res.statusCode = status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(text);
  }

  /** connect 风格中间件；只处理 /api/*，其余交给下一层（Vite 或静态文件） */
  function middleware(req, res, next) {
    let url;
    try {
      url = new URL(req.url || '/', 'http://localhost');
    } catch {
      if (next) next();
      return;
    }
    if (!url.pathname.startsWith('/api/')) { if (next) next(); return; }

    if (url.pathname === '/api/meta') {
      if (req.method !== 'GET' && req.method !== 'HEAD') { sendJson(res, 405, { error: 'method_not_allowed' }); return; }
      sendJson(res, 200, stats());
      return;
    }

    if (url.pathname === '/api/digits') {
      if (req.method !== 'GET' && req.method !== 'HEAD') { sendJson(res, 405, { error: 'method_not_allowed' }); return; }
      const fromRaw = url.searchParams.get('from');
      const countRaw = url.searchParams.get('count');
      const from = Number(fromRaw);
      const count = countRaw === null ? 100 : Number(countRaw);
      if (!Number.isInteger(from) || from < 1) { sendJson(res, 400, { error: 'bad_request', message: 'from 必须是 >=1 的整数', from: fromRaw }); return; }
      if (!Number.isInteger(count) || count < 1) { sendJson(res, 400, { error: 'bad_request', message: 'count 必须是 >=1 的整数', count: countRaw }); return; }
      const maxCount = blockSize + MAX_RANGE_OVERLAP;
      if (count > maxCount) { sendJson(res, 400, { error: 'bad_request', message: 'count 不得超过 ' + maxCount, count }); return; }
      if (from > decimalDigits) { sendJson(res, 400, { error: 'bad_request', message: 'from 超出范围（最大 ' + decimalDigits + '）', from }); return; }
      getDigits(from, count).then(
        (digits) => {
          if (res.writableEnded) return;
          res.statusCode = 200;
          res.setHeader('content-type', 'text/plain; charset=ascii');
          res.setHeader('cache-control', 'no-store');
          res.setHeader('x-pi-from', String(from));
          res.setHeader('x-pi-count', String(digits.length));
          if (req.method === 'HEAD') { res.end(); return; }
          res.end(digits);
        },
        (error) => {
          if (res.writableEnded) return;
          const status = error instanceof RangeError ? 400 : 502;
          sendJson(res, status, {
            error: status === 400 ? 'bad_request' : 'upstream_unavailable',
            message: error && error.message,
            from,
            count,
          });
        }
      );
      return;
    }

    sendJson(res, 404, { error: 'unknown_api', path: url.pathname });
  }

  return { middleware, ensureBlock, getDigits, stats, cacheDir, isBlockCached, blockPath, blockLength, blockSize, decimalDigits };
}

export default createPiService;

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error 纯 ESM 模块，没有类型声明
import { byteOffsetOf, createPiService, MAX_RANGE_OVERLAP } from '../server/pi-service.mjs';
import { encodingsFor } from '../src/lib/encodings';
import { byteOffsetOfPosition } from '../src/lib/position';

/** 200 位小数的合成上游：内容确定、长度可控，用来做小规模分块测试 */
const DECIMALS = Array.from({ length: 200 }, (_, i) => String((i * 7 + 3) % 10)).join('');
const FULL = '3.' + DECIMALS;

interface FetchCall {
  start: number;
  end: number;
}

function makeFetch(
  full: string,
  behaviour: { shortFirst?: boolean; alwaysFail?: boolean } = {}
): { fetchImpl: (url: string, init: { headers: Record<string, string> }) => Promise<unknown>; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  let attempts = 0;
  const fetchImpl = async (_url: string, init: { headers: Record<string, string> }) => {
    const match = /bytes=(\d+)-(\d+)/.exec(init.headers.Range);
    if (!match) throw new Error('缺少 Range 头：' + JSON.stringify(init.headers));
    const start = Number(match[1]);
    const end = Number(match[2]);
    calls.push({ start, end });
    attempts++;
    if (behaviour.alwaysFail) throw new Error('网络不可用');
    const body = full.slice(start, end + 1);
    if (behaviour.shortFirst && attempts === 1) {
      const short = body.slice(0, 5);
      return { ok: true, status: 206, arrayBuffer: async () => new TextEncoder().encode(short) };
    }
    return { ok: true, status: 206, arrayBuffer: async () => new TextEncoder().encode(body) };
  };
  return { fetchImpl, calls };
}

function makeService(options: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pi-service-'));
  const behaviour = (options.behaviour ?? {}) as { shortFirst?: boolean; alwaysFail?: boolean };
  const { fetchImpl, calls } = makeFetch(FULL, behaviour);
  const service = createPiService({
    cacheDir: dir,
    blockSize: 50,
    totalBytes: FULL.length,
    decimalDigits: 200,
    concurrency: 2,
    retries: 2,
    fetchImpl,
    ...options,
  });
  return { service, calls, dir, fetchImpl };
}

const cleanups: string[] = [];
afterEach(() => {
  while (cleanups.length) rmSync(cleanups.pop() as string, { recursive: true, force: true });
});

describe('getDigits 与块缓存', () => {
  it('第 1 位起 10 位 = 上游字节 2..11', async () => {
    const { service, calls } = makeService();
    cleanups.push(service.cacheDir);
    await expect(service.getDigits(1, 10)).resolves.toBe(FULL.slice(2, 12));
    expect(calls[0]).toEqual({ start: 0, end: 49 });
  });

  it('跨块取数会拼起来', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    await expect(service.getDigits(1, 60)).resolves.toBe(FULL.slice(2, 62));
    const cached = service.stats();
    expect(cached.cachedBlocks).toBe(2);
  });

  it('同一块的并发请求只下载一次', async () => {
    const { service, calls } = makeService();
    cleanups.push(service.cacheDir);
    await Promise.all([service.ensureBlock(1), service.ensureBlock(1), service.ensureBlock(1)]);
    expect(calls.filter((c) => c.start === 50).length).toBe(1);
  });

  it('已缓存后不再请求上游', async () => {
    const { service, calls } = makeService();
    cleanups.push(service.cacheDir);
    await service.getDigits(1, 10);
    const before = calls.length;
    await service.getDigits(1, 10);
    expect(calls.length).toBe(before);
  });

  it('长度不对会重试', async () => {
    const { service, calls } = makeService({ behaviour: { shortFirst: true } });
    cleanups.push(service.cacheDir);
    await expect(service.getDigits(1, 10)).resolves.toBe(FULL.slice(2, 12));
    expect(calls.length).toBeGreaterThan(1);
  }, 15_000);

  it('上游一直失败就抛错', async () => {
    const { service } = makeService({ behaviour: { alwaysFail: true } });
    cleanups.push(service.cacheDir);
    await expect(service.getDigits(1, 10)).rejects.toThrow(/下载失败/);
  }, 15_000);

  it('参数越界抛 RangeError', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    await expect(service.getDigits(0, 10)).rejects.toThrow(RangeError);
    await expect(service.getDigits(1, 0)).rejects.toThrow(RangeError);
    await expect(service.getDigits(201, 1)).rejects.toThrow(RangeError);
  });
});

interface FakeResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  writableEnded: boolean;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

function fakeRes(): FakeResponse {
  const res: FakeResponse = {
    statusCode: 200,
    headers: {},
    body: '',
    writableEnded: false,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = String(value);
    },
    end(body) {
      res.writableEnded = true;
      if (body !== undefined) res.body = body;
    },
  };
  return res;
}

async function dispatch(
  service: { middleware: (req: unknown, res: unknown, next: () => void) => void },
  url: string,
  method = 'GET'
): Promise<{ res: FakeResponse; nextCalled: boolean }> {
  const res = fakeRes();
  let nextCalled = false;
  service.middleware({ url, method }, res, () => {
    nextCalled = true;
  });
  const deadline = Date.now() + 5000;
  while (!res.writableEnded && !nextCalled && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return { res, nextCalled };
}

describe('HTTP 中间件', () => {
  it('/api/meta 返回数据源信息', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    const { res } = await dispatch(service, '/api/meta');
    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.source).toBe('mit-pi-billion');
    expect(body.totalDigits).toBe(200);
    expect(body.blockSize).toBe(50);
    expect(body.blockCount).toBe(5);
  });

  it('/api/digits 返回纯文本并带坐标头', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    const { res } = await dispatch(service, '/api/digits?from=1&count=10');
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(FULL.slice(2, 12));
    expect(res.headers['content-type']).toBe('text/plain; charset=ascii');
    expect(res.headers['x-pi-from']).toBe('1');
    expect(res.headers['x-pi-count']).toBe('10');
  });

  it('坏参数返回 400', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    const tooMany = 50 + MAX_RANGE_OVERLAP + 1; // 块大小 50 + 允许的重叠 16，再多一位才拒绝
    for (const url of ['/api/digits?from=0&count=10', '/api/digits?from=1&count=0', `/api/digits?from=1&count=${tooMany}`, '/api/digits?from=201&count=1']) {
      const { res } = await dispatch(service, url);
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe('bad_request');
    }
  });

  it('跨块重叠允许比块大小多取少量位数', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    const { res } = await dispatch(service, `/api/digits?from=1&count=${50 + MAX_RANGE_OVERLAP}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(FULL.slice(2, 2 + 50 + MAX_RANGE_OVERLAP));
  });

  it('上游不可用返回 502 且不谎报数据', async () => {
    const { service } = makeService({ behaviour: { alwaysFail: true } });
    cleanups.push(service.cacheDir);
    const { res } = await dispatch(service, '/api/digits?from=1&count=10');
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('upstream_unavailable');
    expect(body.from).toBe(1);
    expect(body.count).toBe(10);
  }, 15_000);

  it('非 GET 拒绝', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    const { res } = await dispatch(service, '/api/digits?from=1&count=10', 'POST');
    expect(res.statusCode).toBe(405);
  });

  it('未知 /api 路径返回 404', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    const { res } = await dispatch(service, '/api/nope');
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).error).toBe('unknown_api');
  });

  it('非 /api 路径交给下一层', async () => {
    const { service } = makeService();
    cleanups.push(service.cacheDir);
    const { nextCalled } = await dispatch(service, '/index.html');
    expect(nextCalled).toBe(true);
  });
});

// 前后端之间有两处「看不见的约定」，写坏了不会立刻报错，只会少扫或多扫几个位置：
// 1. 浏览器每块要多取 maxNeedleLen-1 位做跨块重叠，服务的上限是 blockSize + MAX_RANGE_OVERLAP；
// 2. 「小数点后第 k 位」换算成上游字节偏移，两边各有一份实现。
describe('前后端约定（跨块重叠与字节偏移口径）', () => {
  it('最长写法的位数不超过服务允许的跨块重叠', () => {
    const longest = encodingsFor(new Date(2028, 1, 29)).reduce((max, item) => Math.max(max, item.digits.length), 0);
    expect(longest).toBeGreaterThan(0);
    expect(MAX_RANGE_OVERLAP).toBeGreaterThanOrEqual(longest - 1);
  });

  it('前端与服务对「第 k 位 → 字节偏移」的换算一致', () => {
    for (const position of [1, 2, 762, 9_999, 1_000_000, 1_000_000_000]) {
      expect(byteOffsetOfPosition(position)).toBe(byteOffsetOf(position));
    }
  });
});

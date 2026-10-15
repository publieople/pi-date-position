// 数字来源：优先本机 π 服务（/api/digits，可查到小数点后 10 亿位），
// 没有服务时降级到 public/pi-1m.txt（前 100 万位，静态文件）。
export type SourceKind = 'server' | 'static' | 'unavailable';

export interface DigitSource {
  kind: SourceKind;
  /** 该来源能提供的最深位数 */
  maxDigits: number;
  totalBytes?: number;
  /** 给人看的来源说明 */
  label: string;
  fetchRange(from: number, count: number, signal?: AbortSignal): Promise<string>;
  /** 超出本地范围时的在线取数能力（目前只有静态来源有） */
  remote?: RemoteWindow;
}

const DIGITS_ONLY = /[^0-9]/g;

/**
 * 站点可能部署在子路径下（GitHub Pages 的项目站是 /<repo>/），
 * 所有同源请求都要带上 base；本机 dev 下 base 就是 '/'，行为不变。
 */
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function fetchText(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new HttpError(response.status, url + ' → HTTP ' + response.status);
  return await response.text();
}

/** 上游之外的第三个数据源：api.pi.delivery（带 CORS `*`，单次最多 1000 位）。
 *  只在命中位次超出本地数据源时，用来取回命中点附近的一小段真实数字。 */
export const REMOTE_API = 'https://api.pi.delivery/v1/pi';
export const REMOTE_MAX_PER_REQUEST = 1000;
export const REMOTE_MAX_DIGITS = 1_000_000_000;

export interface RemoteWindow {
  label: string;
  /** 单次请求能取回的最多位数 */
  maxPerRequest: number;
  /** 能覆盖的最深位数 */
  maxDigits: number;
  fetchDigits(from: number, count: number, signal?: AbortSignal): Promise<string>;
}

/**
 * 命中点附近的取数窗口：前面留 `before` 位，单次上限截断；
 * 超出可取深度、或位次不合法时返回 null。
 */
export function remoteWindowRange(
  position: number,
  needleLength: number,
  before = 40,
  maxPerRequest = REMOTE_MAX_PER_REQUEST,
  maxDigits = REMOTE_MAX_DIGITS,
): { from: number; count: number } | null {
  if (!Number.isFinite(position) || position < 1 || position > maxDigits) return null;
  const from = Math.max(1, position - before);
  const count = Math.min(before * 2 + needleLength, maxPerRequest, maxDigits - from + 1);
  if (count <= 0 || from + count - 1 < position + needleLength - 1) return null;
  return { from, count };
}

/** 包一层 `fetch`，方便注入替身做单测；返回的内容必须是纯数字且位数吻合。 */
export function createRemoteWindow(fetchImpl: typeof fetch = fetch, apiBase = REMOTE_API): RemoteWindow {
  return {
    label: 'api.pi.delivery',
    maxPerRequest: REMOTE_MAX_PER_REQUEST,
    maxDigits: REMOTE_MAX_DIGITS,
    async fetchDigits(from, count, signal) {
      const url = apiBase + '?start=' + from + '&numberOfDigits=' + count;
      const response = await fetchImpl(url, { signal });
      if (!response.ok) throw new HttpError(response.status, url + ' → HTTP ' + response.status);
      const payload = (await response.json()) as { content?: unknown };
      const digits = String(payload?.content ?? '').replace(DIGITS_ONLY, '');
      if (digits.length !== count) {
        throw new Error('api.pi.delivery 返回 ' + digits.length + ' 位，期望 ' + count + ' 位');
      }
      return digits;
    },
  };
}

interface MetaPayload {
  totalDigits?: number;
  totalBytes?: number;
  blockSize?: number;
  cachedBlocks?: number;
  upstream?: string;
  source?: string;
}

/** 探测本机 π 服务；不可用则回退到静态 100 万位文件。 */
export async function probeSource(options: { timeoutMs?: number } = {}): Promise<DigitSource> {
  const timeoutMs = options.timeoutMs ?? 4000;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let meta: MetaPayload;
    try {
      meta = JSON.parse(await fetchText(BASE + '/api/meta', controller.signal)) as MetaPayload;
    } finally {
      clearTimeout(timer);
    }
    if (!meta || typeof meta.totalDigits !== 'number' || meta.totalDigits < 1000) throw new Error('meta 不合法');
    const totalDigits = meta.totalDigits;
    return {
      kind: 'server',
      maxDigits: totalDigits,
      totalBytes: meta.totalBytes,
      label: '本机 π 服务（MIT pi-billion.txt 代理，最深 10 亿位）',
      async fetchRange(from, count, signal) {
        const available = Math.max(0, Math.min(count, totalDigits - from + 1));
        if (available <= 0) throw new Error('超出可用范围');
        const text = await fetchText(BASE + '/api/digits?from=' + from + '&count=' + available, signal);
        const digits = text.replace(DIGITS_ONLY, '');
        if (digits.indexOf('.') === -1 && digits.length !== available) {
          throw new Error('服务返回 ' + digits.length + ' 位，期望 ' + available + ' 位');
        }
        return digits;
      },
    };
  } catch {
    /* 继续尝试静态回退 */
  }

  try {
    const text = (await fetchText(BASE + '/pi-1m.txt')).replace(DIGITS_ONLY, '');
    if (text.length < 1000) throw new Error('静态 π 文件内容不足');
    return {
      kind: 'static',
      maxDigits: text.length,
      label: '站点内置静态 π 文件（前 ' + text.length.toLocaleString('en-US') + ' 位）',
      // 超出内置副本的位次：用带 CORS 的公开接口取回命中点附近的一小段
      remote: createRemoteWindow(),
      async fetchRange(from, count) {
        const start = Math.max(1, from);
        const available = Math.max(0, Math.min(count, text.length - start + 1));
        if (available <= 0) throw new Error('超出静态文件范围');
        return text.slice(start - 1, start - 1 + available);
      },
    };
  } catch {
    /* 彻底不可用 */
  }

  return {
    kind: 'unavailable',
    maxDigits: 0,
    label: '没有可用的 π 数据源',
    async fetchRange() {
      throw new Error('没有可用的 π 数据源：本机服务未启动，且站点自带的 public/pi-1m.txt 缺失或读取失败');
    },
  };
}

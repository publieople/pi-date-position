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

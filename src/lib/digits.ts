import { assetUrl } from './assets';
import type { DigitWindow, Verification } from './types';

const API_BASE = 'https://api.pi.delivery/v1/pi';
const LOCAL_LIMIT = 1_000_000;
const DEPTH_LIMIT = 1_000_000_000;
const API_MAX = 1000;
const PAD_BEFORE = 20;
const PAD_AFTER = 40;

let localPromise: Promise<string> | null = null;
const apiCache = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function loadLocalPi(): Promise<string> {
  if (!localPromise) {
    localPromise = fetch(assetUrl('pi-1m.txt'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('本地 π 数字副本读取失败（HTTP ' + response.status + '）');
        }
        return response.text();
      })
      .then((text) => {
        const digits = text.replace(/\s+/g, '');
        if (!/^\d{1000000}$/.test(digits)) {
          throw new Error('本地 π 数字副本长度不正确（' + digits.length + ' 位）');
        }
        return digits;
      });
    localPromise.catch(() => {
      localPromise = null;
    });
  }
  return localPromise;
}

export function windowFor(position: number, needleLength: number): { start: number; end: number; count: number } {
  if (!Number.isInteger(position) || position < 1 || position > DEPTH_LIMIT) {
    throw new Error('位次超出可展示范围');
  }
  const start = Math.max(1, position - PAD_BEFORE);
  const end = Math.min(DEPTH_LIMIT, position + needleLength + PAD_AFTER);
  return { start: start, end: end, count: end - start + 1 };
}

async function fetchApi(start: number, count: number, signal?: AbortSignal): Promise<string> {
  if (count > API_MAX) {
    throw new Error('一次最多取 ' + API_MAX + ' 位');
  }
  const url = API_BASE + '?start=' + start + '&numberOfDigits=' + count;
  const response = await fetch(url, { signal: signal, cache: 'no-store' });
  if (!response.ok) {
    throw new Error('π 数字服务返回 HTTP ' + response.status);
  }
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.content !== 'string') {
    throw new Error('π 数字服务返回格式不正确');
  }
  const digits = payload.content.replace(/\s+/g, '');
  if (digits.length !== count || !/^\d+$/.test(digits)) {
    throw new Error('π 数字服务返回长度不正确');
  }
  return digits;
}

export async function getWindow(
  position: number,
  needleLength: number,
  signal?: AbortSignal,
): Promise<DigitWindow> {
  const range = windowFor(position, needleLength);
  if (range.end <= LOCAL_LIMIT) {
    const local = await loadLocalPi();
    return {
      start: range.start,
      digits: local.slice(range.start - 1, range.end),
      source: 'local',
    };
  }
  const key = String(range.start) + ':' + String(range.count);
  const cached = apiCache.get(key);
  if (cached) {
    return { start: range.start, digits: cached, source: 'api' };
  }
  const digits = await fetchApi(range.start, range.count, signal);
  apiCache.set(key, digits);
  return { start: range.start, digits: digits, source: 'api' };
}

export async function verifyAt(
  position: number,
  needle: string,
  signal?: AbortSignal,
): Promise<Verification> {
  const digits = await fetchApi(position, needle.length, signal);
  return {
    ok: digits === needle,
    digits: digits,
    checkedAt: new Date(),
  };
}

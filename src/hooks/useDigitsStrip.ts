import { useEffect, useState } from 'react';
import type { DigitsStripProps, StripWriting } from '../components/DigitsStrip';
import type { DigitSource } from '../lib/digitSource';
import { remoteWindowRange } from '../lib/digitSource';
import { formatCompact, formatThousands } from '../lib/position';

export type StripState = Omit<DigitsStripProps, 'needle' | 'animate'> & { writing: StripWriting | null };

export const IDLE_STRIP: StripState = {
  status: 'idle',
  from: null,
  digits: null,
  position: null,
  writing: null,
  message: '正在准备扫描…',
};

export interface DigitsStripOptions {
  source: DigitSource | null;
  /** 当前展示的写法（首屏写法选择的结果），没有就是 null */
  digits: string | null;
  position: number | null;
  label: string;
  tentative: boolean;
  /** 首屏主写法，用来写「还没有确认的位次」时的说明文案 */
  primaryDigits: string;
}

const BEFORE = 40;

/**
 * 命中位置附近的数字（高亮展示）。
 *
 * 位次常常在几亿位（表答案），可能超出当前数据源能取到的范围：静态版带在线取数能力
 * （api.pi.delivery，单次上限 1000 位）时取回命中点前后各 40 位，否则如实说明取不到。
 */
export function useDigitsStrip(options: DigitsStripOptions): StripState {
  const { source, digits, position, label, tentative, primaryDigits } = options;
  const [strip, setStrip] = useState<StripState>(IDLE_STRIP);

  useEffect(() => {
    if (!source || source.kind === 'unavailable') {
      setStrip(IDLE_STRIP);
      return;
    }
    if (digits === null || position === null) {
      setStrip({
        status: 'idle',
        from: null,
        digits: null,
        position: null,
        writing: null,
        message:
          primaryDigits +
          ' 在已扫描的范围内还没有确认的位次 —— 可以到下一章深搜到 1 亿 / 10 亿位，或者换一天试试。',
      });
      return;
    }
    const length = digits.length;
    const from = Math.max(1, position - BEFORE);
    const writing: StripWriting = { label, digits, tentative };
    if (from > source.maxDigits) {
      const remote = source.remote;
      const span = remote
        ? remoteWindowRange(position, length, BEFORE, remote.maxPerRequest, remote.maxDigits)
        : null;
      if (remote && span) {
        let alive = true;
        setStrip({ status: 'loading', from: null, digits: null, position, writing });
        remote.fetchDigits(span.from, span.count).then(
          (fetched) => {
            if (!alive) return;
            setStrip({
              status: 'ready',
              from: span.from,
              digits: fetched,
              position,
              writing,
              note:
                '这一段取自 ' +
                remote.label +
                '（本站内置副本只到前 ' +
                formatCompact(source.maxDigits) +
                '位）；位次结论仍以离线预计算表为准。',
            });
          },
          (error: unknown) => {
            if (!alive) return;
            setStrip({
              status: 'idle',
              from: null,
              digits: null,
              position,
              writing,
              message:
                '它落在小数点后第 ' +
                formatThousands(position) +
                ' 位，超出本站内置的前 ' +
                formatCompact(source.maxDigits) +
                ' 位，在线取数也没能取回附近的数字（' +
                String((error as Error)?.message ?? error) +
                '）。在本机跑 pnpm dev 可以直接从本地 π 数据里取。',
            });
          },
        );
        return () => {
          alive = false;
        };
      }
      setStrip({
        status: 'idle',
        from: null,
        digits: null,
        position,
        writing,
        message:
          '它落在小数点后第 ' +
          formatThousands(position) +
          ' 位，而当前数据源只到前 ' +
          formatCompact(source.maxDigits) +
          ' 位 —— 附近的数字取不回来。在本机跑 pnpm dev 可以取到实位。',
      });
      return;
    }
    const count = Math.min(BEFORE * 2 + length, source.maxDigits - from + 1);
    let alive = true;
    setStrip({ status: 'loading', from: null, digits: null, position, writing });
    source.fetchRange(from, count).then(
      (fetched) => {
        if (!alive) return;
        setStrip({ status: 'ready', from, digits: fetched, position, writing });
      },
      (error: unknown) => {
        if (!alive) return;
        setStrip({
          status: 'error',
          from: null,
          digits: null,
          position,
          writing,
          message: String((error as Error)?.message ?? error),
        });
      },
    );
    return () => {
      alive = false;
    };
  }, [source, digits, position, label, tentative, primaryDigits]);

  return strip;
}

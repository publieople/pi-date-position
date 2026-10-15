import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ANSWER_RANGE } from '../lib/answers';
import { encodingsFor, searchNeedles, type Encoding } from '../lib/encodings';
import { clampDateKey, pad2, parseDateKey, toDateKey, withDateParam } from '../lib/position';
import { useNow } from './useNow';

/** 搜索用的一根串：id + 数字 + 它对应的写法标签（与 lib/encodings 的 searchNeedles 对齐） */
export interface NeedleSpec {
  id: string;
  digits: string;
  labels: string[];
}

export interface DateSelection {
  /** 每秒一跳的时钟，首屏与页脚显示用 */
  now: Date;
  todayKey: string;
  /** 用户选中的日期（null = 今天） */
  selectedKey: string | null;
  /** 夹到答案表覆盖范围之后的日期（YYYY-MM-DD）：页面其它地方一律用它 */
  activeKey: string;
  isToday: boolean;
  date: Date;
  encodings: Encoding[];
  needles: NeedleSpec[];
  /** 搜索重启的依赖：串变了才重跑 */
  needleKey: string;
  /** 首屏主写法（YYYYMMDD）的数字串 */
  primaryDigits: string;
  select: (key: string | null) => void;
  step: (days: number) => void;
  random: () => void;
}

/** ?date=YYYY-MM-DD 深链：非法值忽略。 */
function readDateParam(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = new URLSearchParams(window.location.search).get('date');
    return value && parseDateKey(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * 日期选择：今天 / 深链 / 前后一天 / 随机一天，外加把当前日期同步进地址栏。
 *
 * 可选范围就是离线答案表的覆盖范围（1900–2100）：越界（旧链接、手改地址栏）一律夹回边界，
 * 免得页面在这张表之外悄悄降级成「只扫到前 100 万位」的样子。
 */
export function useDateSelection(): DateSelection {
  const now = useNow(1000);
  const todayKey = toDateKey(now);

  const [selectedKey, setSelectedKey] = useState<string | null>(readDateParam);
  const activeKey = clampDateKey(selectedKey ?? todayKey, ANSWER_RANGE.minKey, ANSWER_RANGE.maxKey);
  const isToday = activeKey === todayKey;
  const date = useMemo(() => parseDateKey(activeKey) ?? new Date(), [activeKey]);

  const encodings = useMemo(() => encodingsFor(date), [date]);
  const needles = useMemo(() => searchNeedles(encodings), [encodings]);
  const needleKey = needles.map((needle) => needle.digits).join(',');
  const primaryDigits = encodings[0].digits;

  // 地址栏跟随当前日期：换一天后的链接可以直接分享，浏览器前进 / 后退也能走。
  // 首次同步用 replaceState（深链进来不改历史），之后每次换日期 pushState。
  const urlSyncedRef = useRef(false);
  useEffect(() => {
    const next = withDateParam(window.location.href, activeKey, todayKey);
    if (next !== window.location.href) {
      if (urlSyncedRef.current) window.history.pushState(null, '', next);
      else window.history.replaceState(null, '', next);
    }
    urlSyncedRef.current = true;
  }, [activeKey, todayKey]);

  // 浏览器前进 / 后退：按地址栏里的 ?date= 重新取一天（没有参数就是今天）
  useEffect(() => {
    const onPopState = () => setSelectedKey(readDateParam());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const step = useCallback(
    (days: number) => {
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
      setSelectedKey(clampDateKey(toDateKey(next), ANSWER_RANGE.minKey, ANSWER_RANGE.maxKey));
    },
    [date],
  );

  const random = useCallback(() => {
    const start = Date.parse(ANSWER_RANGE.minKey + 'T00:00:00Z');
    const end = Date.parse(ANSWER_RANGE.maxKey + 'T00:00:00Z');
    const pick = new Date(start + Math.random() * (end - start));
    setSelectedKey(pick.getUTCFullYear() + '-' + pad2(pick.getUTCMonth() + 1) + '-' + pad2(pick.getUTCDate()));
  }, []);

  return {
    now,
    todayKey,
    selectedKey,
    activeKey,
    isToday,
    date,
    encodings,
    needles,
    needleKey,
    primaryDigits,
    select: setSelectedKey,
    step,
    random,
  };
}

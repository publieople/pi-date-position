import { useCallback, useEffect, useRef, useState } from 'react';
import { browserCopyEnvironment, copyText, type CopyState } from '../lib/share';

/** 「已复制 / 复制失败」这两个状态在按钮上停留多久 */
const RESET_MS = 1600;

/**
 * 复制分享链接：点一次把 buildUrl() 的结果写进剪贴板，1.6 秒后按钮回到初始文案。
 * buildUrl 存在 ref 里，所以调用方不必把它包成 useCallback。
 */
export function useCopyLink(buildUrl: () => string): { state: CopyState; copy: () => void } {
  const [state, setState] = useState<CopyState>('idle');
  const buildRef = useRef(buildUrl);
  buildRef.current = buildUrl;
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  const copy = useCallback(() => {
    void copyText(buildRef.current(), browserCopyEnvironment()).then((ok) => {
      setState(ok ? 'copied' : 'failed');
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setState('idle'), RESET_MS);
    });
  }, []);

  return { state, copy };
}

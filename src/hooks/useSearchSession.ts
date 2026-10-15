import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { DigitSource } from '../lib/digitSource';
import { clearCache, loadCache, saveCache, type CachedResult } from '../lib/resultCache';
import { findOccurrencesInText } from '../lib/searchCore';
import { PiSearchRun, type ScanSnapshot, type Scanner } from '../lib/searchEngine';
import type { ScanPool } from '../lib/workerScanner';
import type { NeedleSpec } from './useDateSelection';

export interface SearchSessionOptions {
  source: DigitSource | null;
  needles: NeedleSpec[];
  /** needles 的数字串拼起来：串变了才重跑 */
  needleKey: string;
  targetDigits: number;
  activeKey: string;
  poolRef: RefObject<ScanPool | null>;
}

export interface SearchSession {
  snapshot: ScanSnapshot | null;
  runRef: RefObject<PiSearchRun | null>;
  cache: Record<string, CachedResult>;
  /** 手动重跑一遍（换目标深度后也走这个） */
  restart: () => void;
  /** 清掉当前日期的结果缓存并重跑 */
  clearCachedResults: () => void;
}

/**
 * 实时扫描会话：日期 / 目标深度 / 手动重跑变化时重启引擎，
 * 把每个写法的首个确认命中写进按日期分片的 localStorage 缓存。
 */
export function useSearchSession(options: SearchSessionOptions): SearchSession {
  const { source, needles, needleKey, targetDigits, activeKey, poolRef } = options;
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [cache, setCache] = useState<Record<string, CachedResult>>({});
  const [runToken, setRunToken] = useState(0);

  const runRef = useRef<PiSearchRun | null>(null);
  const runIdRef = useRef(0);
  const persistedRef = useRef<Set<string>>(new Set());

  // 每日期一份结果缓存（localStorage）
  useEffect(() => {
    setCache(loadCache(activeKey));
    persistedRef.current = new Set();
  }, [activeKey]);

  // 搜索引擎：日期 / 上限 / 手动重跑变化时重启
  useEffect(() => {
    if (!source || source.kind === 'unavailable' || needles.length === 0) {
      setSnapshot(null);
      return;
    }
    const myRun = ++runIdRef.current;
    const pool = poolRef.current;
    const scanner: Scanner = pool
      ? pool.scanner
      : async (text, windowStart, list) => findOccurrencesInText(text, windowStart, list);
    const run = new PiSearchRun({
      needles: needles.map((needle) => ({ id: needle.id, digits: needle.digits })),
      source,
      targetDigits,
      scanner,
      concurrency: pool ? Math.max(3, pool.size) : 2,
      onUpdate: (snap) => {
        if (runIdRef.current !== myRun) return;
        setSnapshot(snap);
        for (const needle of snap.needles) {
          if (!needle.firstHitConfirmed || needle.firstHit === null) continue;
          const key = activeKey + '|' + needle.digits;
          if (persistedRef.current.has(key)) continue;
          persistedRef.current.add(key);
          saveCache(activeKey, needle.digits, {
            position: needle.firstHit,
            scannedThrough: snap.checkedDigits,
            checkedAt: Date.now(),
          });
          setCache(loadCache(activeKey));
        }
      },
    });
    runRef.current = run;
    setSnapshot(run.snapshot());
    void run.start();
    return () => {
      run.stop();
      runRef.current = null;
    };
  }, [source, needleKey, targetDigits, runToken, activeKey, needles, poolRef]);

  const restart = useCallback(() => setRunToken((token) => token + 1), []);

  const clearCachedResults = useCallback(() => {
    clearCache(activeKey);
    setCache({});
    persistedRef.current = new Set();
    setRunToken((token) => token + 1);
  }, [activeKey]);

  return { snapshot, runRef, cache, restart, clearCachedResults };
}

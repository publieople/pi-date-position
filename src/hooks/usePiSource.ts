import { useEffect, useRef, useState, type RefObject } from 'react';
import { probeSource, type DigitSource } from '../lib/digitSource';
import { createScanPool, type ScanPool } from '../lib/workerScanner';

/** 探测数据源：优先本机 /api（能扫到 10 亿位），其次静态同源的 pi-1m.txt。 */
export function usePiSource(): DigitSource | null {
  const [source, setSource] = useState<DigitSource | null>(null);
  useEffect(() => {
    let alive = true;
    probeSource().then((next) => {
      if (alive) setSource(next);
    });
    return () => {
      alive = false;
    };
  }, []);
  return source;
}

export interface ScanPoolHandle {
  poolRef: RefObject<ScanPool | null>;
  /** 池子里的 Worker 数量（不支持 Worker 时为 1，页面如实显示） */
  workers: number;
}

/** Worker 池：整个页面一份，所有扫描共用；卸载时一起销毁。 */
export function useScanPool(): ScanPoolHandle {
  const poolRef = useRef<ScanPool | null>(null);
  const [workers, setWorkers] = useState(1);
  useEffect(() => {
    const pool = createScanPool();
    poolRef.current = pool;
    setWorkers(pool ? pool.size : 1);
    return () => {
      pool?.dispose();
      poolRef.current = null;
    };
  }, []);
  return { poolRef, workers };
}

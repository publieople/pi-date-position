import { useEffect, useState } from 'react';
import type { SelfCheckState } from '../components/Conventions';
import type { DigitSource } from '../lib/digitSource';

/** 数据自检：第 762 位起应为 999999（费曼点），用来证明页面读到的确实是 π。 */
export function useSelfCheck(source: DigitSource | null): SelfCheckState {
  const [selfCheck, setSelfCheck] = useState<SelfCheckState>({ status: 'idle' });

  useEffect(() => {
    if (!source || source.kind === 'unavailable') return;
    let alive = true;
    setSelfCheck({ status: 'checking' });
    source.fetchRange(762, 6).then(
      (digits) => {
        if (!alive) return;
        setSelfCheck(
          digits === '999999' ? { status: 'ok', got: digits } : { status: 'bad', got: digits, message: '期望 999999' },
        );
      },
      (error: unknown) => {
        if (!alive) return;
        setSelfCheck({ status: 'bad', message: String((error as Error)?.message ?? error) });
      },
    );
    return () => {
      alive = false;
    };
  }, [source]);

  return selfCheck;
}

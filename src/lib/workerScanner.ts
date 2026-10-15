// Worker 池：把「扫描一个文本块」的 CPU 工作放到后台线程。
// 拿不到 Worker（单测 / 老浏览器）时返回 null，调用方退回主线程同步扫描。
import type { Occurrence } from './searchCore';
import type { Scanner } from './searchEngine';
import type { ScanRequest, ScanResponse } from '../workers/search.worker';

export interface ScanPool {
  scanner: Scanner;
  size: number;
  dispose(): void;
}

interface Pending {
  requestId: number;
  resolve: (hits: Occurrence[]) => void;
  reject: (error: Error) => void;
}

interface WorkerSlot {
  worker: Worker;
  chain: Promise<unknown>;
  busy: boolean;
  run: (payload: ScanRequest) => Promise<Occurrence[]>;
}

export function createScanPool(): ScanPool | null {
  if (typeof Worker === 'undefined') return null;
  const hardware = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 4;
  const size = Math.max(1, Math.min(4, hardware - 1));
  const slots: WorkerSlot[] = [];

  try {
    for (let i = 0; i < size; i++) {
      const worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' });
      let pending: Pending | null = null;
      worker.onmessage = (event: MessageEvent<ScanResponse>) => {
        const current = pending;
        if (!current || event.data.requestId !== current.requestId) return;
        pending = null;
        current.resolve(event.data.hits);
      };
      worker.onerror = () => {
        const current = pending;
        pending = null;
        if (current) current.reject(new Error('扫描 Worker 出错'));
      };
      const run = (payload: ScanRequest): Promise<Occurrence[]> =>
        new Promise<Occurrence[]>((resolve, reject) => {
          pending = { requestId: payload.requestId, resolve, reject };
          worker.postMessage(payload);
        });
      slots.push({ worker, chain: Promise.resolve(), busy: false, run });
    }
  } catch {
    for (const slot of slots) slot.worker.terminate();
    return null;
  }

  let counter = 0;
  const scanner: Scanner = (text, windowStart, needles) => {
    const payload: ScanRequest = { requestId: ++counter, text, windowStart, needles };
    const target = slots.find((slot) => !slot.busy) ?? slots[counter % slots.length];
    target.busy = true;
    const result = target.chain.then(
      () => target.run(payload),
      () => target.run(payload)
    );
    target.chain = result.then(
      () => { target.busy = false; },
      () => { target.busy = false; }
    );
    return result;
  };

  return {
    scanner,
    size,
    dispose() {
      for (const slot of slots) slot.worker.terminate();
    },
  };
}

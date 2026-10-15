// 在 Worker 里扫描一个文本块；主线程保持流畅。
import { findOccurrencesInText, type Needle, type Occurrence } from '../lib/searchCore';

export interface ScanRequest {
  requestId: number;
  text: string;
  windowStart: number;
  needles: Needle[];
}

export interface ScanResponse {
  requestId: number;
  hits: Occurrence[];
}

self.onmessage = (event: MessageEvent<ScanRequest>) => {
  const { requestId, text, windowStart, needles } = event.data;
  let hits: Occurrence[] = [];
  try {
    hits = findOccurrencesInText(text, windowStart, needles);
  } catch {
    hits = [];
  }
  const response: ScanResponse = { requestId, hits };
  (self as unknown as Worker).postMessage(response);
};

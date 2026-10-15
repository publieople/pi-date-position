// 一天的日期可以有多种写法；每一种都是一串要在 π 里找的数字。
import { pad2 } from './position';

export type EncodingGroup = 'primary' | 'dashed' | 'long';

export interface Encoding {
  id: string;
  /** 写成什么数字串（前导零保留） */
  digits: string;
  /** 这是哪种写法（给人看的） */
  label: string;
  /** 一句话说明 */
  hint: string;
  group: EncodingGroup;
  /** 与别的写法数字串相同时，这里指向被合并到的 id */
  sameAs?: string;
}

export function encodingsFor(date: Date): Encoding[] {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const MM = pad2(month);
  const DD = pad2(day);
  const YYYY = String(year).padStart(4, '0');
  const YY = YYYY.slice(-2);

  const out: Encoding[] = [
    { id: 'yyyymmdd', digits: YYYY + MM + DD, label: 'YYYYMMDD', hint: '年月日（中国/ISO 常用）', group: 'primary' },
    { id: 'mmdd', digits: MM + DD, label: 'MMDD', hint: '月日（美国写法）', group: 'primary' },
    { id: 'ddmm', digits: DD + MM, label: 'DDMM', hint: '日月（欧洲写法）', group: 'primary' },
    { id: 'yymmdd', digits: YY + MM + DD, label: 'YYMMDD', hint: '两位年 + 月日', group: 'primary' },
    { id: 'mmddyyyy', digits: MM + DD + YYYY, label: 'MMDDYYYY', hint: '美国完整写法', group: 'primary' },
    { id: 'ddmmyyyy', digits: DD + MM + YYYY, label: 'DDMMYYYY', hint: '欧洲完整写法', group: 'primary' },
  ];

  const dashed: Encoding[] = [
    { id: 'iso-dashed', digits: YYYY + MM + DD, label: 'YYYY-MM-DD', hint: '带连字符（数字串与 YYYYMMDD 相同）', group: 'dashed' },
    { id: 'md-dashed', digits: MM + DD, label: 'MM-DD', hint: '带连字符（数字串与 MMDD 相同）', group: 'dashed' },
  ];

  // 去重：MMDD 与 DDMM、以及带连字符写法，数字串可能相同
  const seen = new Map<string, string>();
  for (const item of out) seen.set(item.digits, item.id);
  for (const item of dashed) {
    const existing = seen.get(item.digits);
    if (existing) item.sameAs = existing;
    else seen.set(item.digits, item.id);
  }
  return [...out, ...dashed];
}

/** 只保留真正需要搜索的数字串（去重后），并记录每个数字串对应的全部写法 */
export function searchNeedles(encodings: Encoding[]): Array<{ id: string; digits: string; labels: string[] }> {
  const map = new Map<string, { id: string; digits: string; labels: string[] }>();
  for (const item of encodings) {
    const existing = map.get(item.digits);
    if (existing) existing.labels.push(item.label);
    else map.set(item.digits, { id: item.digits, digits: item.digits, labels: [item.label] });
  }
  return [...map.values()];
}

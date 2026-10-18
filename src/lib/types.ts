export const SLOT_IDS = [
  'yyyyMMdd',
  'mmDd',
  'ddMm',
  'yyMMdd',
  'mmDdYyyy',
  'ddMmYyyy',
] as const;

export type SlotId = (typeof SLOT_IDS)[number];

export type Cell = [position: number, count: number] | null;

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface Manifest {
  version?: number;
  depth: number;
  scannedThrough?: number;
  slots: string[];
  labels: string[];
  needles?: number;
  missing?: number;
  fields?: string[];
  note?: string;
}

export interface YearAnswers {
  year: number;
  depth: number;
  slots: string[];
  labels: string[];
  days: Cell[][];
}

export interface Reading {
  slot: SlotId;
  label: string;
  name: string;
  encoded: string;
  position: number | null;
  count: number | null;
}

export interface DigitWindow {
  start: number;
  digits: string;
  source: 'local' | 'api';
}

export interface Verification {
  ok: boolean;
  digits: string;
  checkedAt: Date;
}

export interface SlotMeta {
  id: SlotId;
  label: string;
  name: string;
  short: string;
}

export const SLOT_META: SlotMeta[] = [
  { id: 'yyyyMMdd', label: 'YYYYMMDD', name: '年月日 · 中国 / ISO', short: '年月日' },
  { id: 'mmDd', label: 'MMDD', name: '月日 · 美国写法', short: '月日' },
  { id: 'ddMm', label: 'DDMM', name: '日月 · 欧洲写法', short: '日月' },
  { id: 'yyMMdd', label: 'YYMMDD', name: '两位年 + 月日', short: '两位年' },
  { id: 'mmDdYyyy', label: 'MMDDYYYY', name: '美国完整写法', short: '美国完整' },
  { id: 'ddMmYyyy', label: 'DDMMYYYY', name: '欧洲完整写法', short: '欧洲完整' },
];

export function slotIndex(slot: SlotId): number {
  return SLOT_IDS.indexOf(slot);
}

export function isSlotId(value: string): value is SlotId {
  return (SLOT_IDS as readonly string[]).indexOf(value) >= 0;
}

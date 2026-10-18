import { assetUrl } from './assets';
import { dayOfYear, daysInYear, encodeDate } from './date';
import {
  SLOT_IDS,
  SLOT_META,
  isSlotId,
  slotIndex,
} from './types';
import type { Cell, DateParts, Manifest, Reading, SlotId, YearAnswers } from './types';

const yearCache = new Map<number, Promise<YearAnswers>>();
let manifestPromise: Promise<Manifest> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    return fallback;
  }
  return value as string[];
}

export function validateManifest(value: unknown): Manifest {
  if (!isRecord(value)) {
    throw new Error('答案表清单格式不正确');
  }
  const depth = asNumber(value.depth, 0);
  if (depth <= 0) {
    throw new Error('答案表清单缺少有效深度');
  }
  return {
    version: typeof value.version === 'number' ? value.version : undefined,
    depth: depth,
    scannedThrough: typeof value.scannedThrough === 'number' ? value.scannedThrough : undefined,
    slots: asStringArray(value.slots, SLOT_IDS.slice()),
    labels: asStringArray(value.labels, SLOT_META.map((item) => item.label)),
    needles: typeof value.needles === 'number' ? value.needles : undefined,
    missing: typeof value.missing === 'number' ? value.missing : undefined,
    fields: asStringArray(value.fields, ['position', 'count']),
    note: typeof value.note === 'string' ? value.note : undefined,
  };
}

export async function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(assetUrl('answers/manifest.json'))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('答案表清单读取失败（HTTP ' + response.status + '）');
        }
        return response.json() as Promise<unknown>;
      })
      .then(validateManifest);
    manifestPromise.catch(() => {
      manifestPromise = null;
    });
  }
  return manifestPromise;
}

function validateCell(value: unknown, year: number, dayIndex: number): Cell {
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('答案表格式不正确：' + year + ' 年第 ' + (dayIndex + 1) + ' 天');
  }
  const position = value[0];
  const count = value[1];
  if (
    typeof position !== 'number' ||
    typeof count !== 'number' ||
    !Number.isInteger(position) ||
    !Number.isInteger(count) ||
    position < 1 ||
    position > 1_000_000_000 ||
    count < 1
  ) {
    throw new Error('答案表格式不正确：' + year + ' 年第 ' + (dayIndex + 1) + ' 天');
  }
  return [position, count];
}

export function validateYear(value: unknown, year: number): YearAnswers {
  if (!isRecord(value)) {
    throw new Error('答案表格式不正确：' + year + ' 年');
  }
  if (!Array.isArray(value.days) || value.days.length !== daysInYear(year)) {
    throw new Error('答案表天数不正确：' + year + ' 年');
  }
  const days = value.days.map((row, dayIndex) => {
    if (!Array.isArray(row) || row.length !== SLOT_IDS.length) {
      throw new Error('答案表槽位不正确：' + year + ' 年第 ' + (dayIndex + 1) + ' 天');
    }
    return row.map((cell) => validateCell(cell, year, dayIndex));
  });
  return {
    year: year,
    depth: asNumber(value.depth, 1_000_000_000),
    slots: asStringArray(value.slots, SLOT_IDS.slice()),
    labels: asStringArray(value.labels, SLOT_META.map((item) => item.label)),
    days: days,
  };
}

export async function loadYear(year: number): Promise<YearAnswers> {
  const cached = yearCache.get(year);
  if (cached) {
    return cached;
  }
  const promise = fetch(assetUrl('answers/' + year + '.json'))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('答案表读取失败（HTTP ' + response.status + '）');
      }
      return response.json() as Promise<unknown>;
    })
    .then((value) => validateYear(value, year));
  yearCache.set(year, promise);
  promise.catch(() => {
    yearCache.delete(year);
  });
  return promise;
}

export function depthOf(manifest: Manifest | null, answers: YearAnswers | null): number {
  return answers ? answers.depth : manifest ? manifest.depth : 1_000_000_000;
}

export function readingFor(answers: YearAnswers, date: DateParts, slot: SlotId): Reading | null {
  if (answers.year !== date.year) {
    return null;
  }
  const row = answers.days[dayOfYear(date)];
  if (!row) {
    return null;
  }
  const index = slotIndex(slot);
  const meta = SLOT_META[index];
  if (!meta) {
    return null;
  }
  const cell = row[index] || null;
  return {
    slot: meta.id,
    label: meta.label,
    name: meta.name,
    encoded: encodeDate(date, meta.id),
    position: cell ? cell[0] : null,
    count: cell ? cell[1] : null,
  };
}

export function readingsFor(answers: YearAnswers, date: DateParts): Reading[] {
  return SLOT_META.map((meta) => readingFor(answers, date, meta.id)).filter(
    (reading): reading is Reading => reading !== null,
  );
}

export function blankReadings(date: DateParts): Reading[] {
  return SLOT_META.map((meta) => ({
    slot: meta.id,
    label: meta.label,
    name: meta.name,
    encoded: encodeDate(date, meta.id),
    position: null,
    count: null,
  }));
}

export function slotFromParam(value: string | null): SlotId | null {
  if (!value || !isSlotId(value)) {
    return null;
  }
  return value;
}

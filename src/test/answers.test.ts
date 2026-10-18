import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readingsFor, slotFromParam, validateManifest, validateYear } from '../lib/answers';
import { dayOfYear } from '../lib/date';
import type { YearAnswers } from '../lib/types';

const root = resolve(process.cwd(), 'public/answers');

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(resolve(root, name), 'utf8')) as unknown;
}

const manifest = validateManifest(readJson('manifest.json'));

describe('answer manifest', () => {
  it('keeps the published depth and slot order', () => {
    expect(manifest.depth).toBe(1_000_000_000);
    expect(manifest.slots).toEqual(['yyyymmdd', 'mmdd', 'ddmm', 'yymmdd', 'mmddyyyy', 'ddmmyyyy']);
    expect(manifest.missing).toBe(6);
  });
});

describe('answer tables', () => {
  const years = new Map<number, YearAnswers>();
  for (let year = 1900; year <= 2100; year += 1) {
    years.set(year, validateYear(readJson(String(year) + '.json'), year));
  }

  it('covers every year with the right number of days', () => {
    expect(years.size).toBe(201);
    let nulls = 0;
    let invalid = 0;
    let max = 0;
    years.forEach((answers) => {
      const leap = answers.year % 4 === 0 && (answers.year % 100 !== 0 || answers.year % 400 === 0);
      expect(answers.days).toHaveLength(leap ? 366 : 365);
      answers.days.forEach((row) => {
        if (row.length !== 6) {
          invalid += 1;
          return;
        }
        row.forEach((cell) => {
          if (cell === null) {
            nulls += 1;
            return;
          }
          if (cell[0] < 1 || cell[0] > 1_000_000_000 || cell[1] < 1) {
            invalid += 1;
          }
          max = Math.max(max, cell[0]);
        });
      });
    });
    expect(invalid).toBe(0);
    expect(nulls).toBe(6);
    expect(max).toBe(997_167_061);
  });

  it('matches the 2026-10-18 acceptance row', () => {
    const answers = years.get(2026);
    if (!answers) {
      throw new Error('missing 2026');
    }
    const readings = readingsFor(answers, { year: 2026, month: 10, day: 18 });
    expect(readings.map((reading) => [reading.encoded, reading.position, reading.count])).toEqual([
      ['20261018', 131_535_897, 6],
      ['1018', 1_223, 100_360],
      ['1810', 12_097, 100_320],
      ['261018', 160_957, 1_023],
      ['10182026', 48_026_541, 8],
      ['18102026', 15_540_281, 11],
    ]);
    expect(answers.days[dayOfYear({ year: 2026, month: 10, day: 18 })]).toHaveLength(6);
  });

  it('matches the 2028-02-29 acceptance row', () => {
    const answers = years.get(2028);
    if (!answers) {
      throw new Error('missing 2028');
    }
    expect(answers.days[dayOfYear({ year: 2028, month: 2, day: 29 })]).toEqual([
      [476_618_908, 9],
      [6_706, 100_385],
      [713, 99_749],
      [451_478, 991],
      [49_701_240, 7],
      [101_597_445, 6],
    ]);
  });

  it('keeps a known missing reading as null', () => {
    const answers = years.get(1920);
    if (!answers) {
      throw new Error('missing 1920');
    }
    const row = answers.days[dayOfYear({ year: 1920, month: 11, day: 30 })];
    expect(row[0]).toBeNull();
    expect(row[1]).toEqual([9_106, 99_720]);
    expect(row[2]).toEqual([492, 100_188]);
  });

  it('parses slot ids from URLs', () => {
    expect(slotFromParam('mmDd')).toBe('mmDd');
    expect(slotFromParam('nope')).toBeNull();
    expect(slotFromParam(null)).toBeNull();
  });
});

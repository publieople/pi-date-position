import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { windowFor } from '../lib/digits';

const pi = readFileSync(resolve(process.cwd(), 'public/pi-1m.txt'), 'utf8').replace(/\s+/g, '');

describe('digit windows', () => {
  it('loads exactly one million digits locally', () => {
    expect(pi).toHaveLength(1_000_000);
    expect(pi.startsWith('141592653589')).toBe(true);
  });

  it('contains the Feynman point at 762', () => {
    expect(pi.slice(761, 767)).toBe('999999');
  });

  it('places 1018 at position 1223', () => {
    const window = windowFor(1223, 4);
    expect(window.start).toBe(1203);
    expect(window.end).toBe(1267);
    expect(pi.slice(window.start - 1, window.end).slice(20, 24)).toBe('1018');
  });

  it('places 20261018 at position 131535897 in the API range', () => {
    const window = windowFor(131535897, 8);
    expect(window.start).toBe(131535877);
    expect(window.end).toBe(131535945);
    expect(window.count).toBe(69);
  });

  it('clamps the start at the first digit', () => {
    const window = windowFor(3, 8);
    expect(window.start).toBe(1);
    expect(window.end).toBe(51);
  });
});

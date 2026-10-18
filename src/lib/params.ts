import { clampDate, isInRange, parseISODate, toDateKey, todayParts } from './date';
import { SLOT_IDS } from './types';
import type { DateParts, SlotId } from './types';

export interface InitialState {
  date: DateParts;
  slot: SlotId;
  pinned: boolean;
}

export function readInitialState(): InitialState {
  const params = new URLSearchParams(window.location.search);
  const rawDate = params.get('date');
  const parsed = rawDate ? parseISODate(rawDate) : null;
  const validDate = parsed && isInRange(parsed) ? clampDate(parsed) : null;
  const date = validDate || todayParts();
  const rawSlot = params.get('slot');
  const slot = rawSlot && (SLOT_IDS as readonly string[]).indexOf(rawSlot) >= 0 ? (rawSlot as SlotId) : 'yyyyMMdd';
  return {
    date: date,
    slot: slot,
    pinned: Boolean(validDate),
  };
}

export function writeParams(date: DateParts, slot: SlotId, pinned: boolean): void {
  const url = new URL(window.location.href);
  if (pinned || slot !== 'yyyyMMdd') {
    url.searchParams.set('date', toDateKey(date));
    if (slot !== 'yyyyMMdd') {
      url.searchParams.set('slot', slot);
    } else {
      url.searchParams.delete('slot');
    }
  } else {
    url.searchParams.delete('date');
    url.searchParams.delete('slot');
  }
  const next = url.pathname + url.search + url.hash;
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (next !== current) {
    window.history.replaceState(null, '', next);
  }
}

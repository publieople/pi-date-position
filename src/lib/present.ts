// 首屏展示哪一条写法：纯选择逻辑，方便单测。
// 依据：主写法（8 位完整写法）在 1000 万位内往往还没出现，所以优先展示「这一天里最早确认命中的写法」。
export interface PresentableNeedle {
  digits: string;
  firstHit: number | null;
  firstHitConfirmed: boolean;
  origin?: 'scan' | 'table';
  knownThrough?: number;
}

export interface PresentedNeedle {
  digits: string;
  position: number;
  tentative: boolean;
  label: string;
  origin?: 'scan' | 'table';
  knownThrough?: number;
}

/**
 * `states` 用搜索顺序（主写法在前的六种写法）；`primaryDigits` 是首屏指定的主写法。
 * 规则：主写法已确认就用它；否则取「已确认写法里位次最靠前」的那个；都没有确认命中时
 * 退而用主写法的暂定位次，再退到顺序里第一个有命中的写法，最后才返回 null。
 */
export function pickDisplayNeedle(
  states: readonly PresentableNeedle[],
  primaryDigits: string,
  labelOf: (digits: string) => string = (digits) => digits,
): PresentedNeedle | null {
  const pick = (digits: string): PresentedNeedle | null => {
    const state = states.find((needle) => needle.digits === digits);
    if (!state || state.firstHit === null) return null;
    return {
      digits,
      position: state.firstHit,
      tentative: !state.firstHitConfirmed,
      label: labelOf(digits),
      origin: state.origin,
      knownThrough: state.knownThrough,
    };
  };

  const direct = pick(primaryDigits);
  if (direct && !direct.tentative) return direct;

  let best: PresentedNeedle | null = null;
  for (const needle of states) {
    const candidate = pick(needle.digits);
    if (!candidate || candidate.tentative) continue;
    if (best === null || candidate.position < best.position) best = candidate;
  }
  if (best) return best;
  if (direct) return direct;

  for (const needle of states) {
    const candidate = pick(needle.digits);
    if (candidate) return candidate;
  }
  return null;
}

import { formatCompact, formatThousands } from './position';
import type { NeedleState, ScanSnapshot } from './searchEngine';

export type HeadlineTone = 'pending' | 'found' | 'tentative' | 'partial' | 'notfound' | 'searching';

export interface Headline {
  text: string;
  tone: HeadlineTone;
}

/** 一句话结论：只有第 1 位到「命中起点 + 数字串长度 - 1」全部扫过才算「已确认」。 */
export function headline(
  primaryDigits: string,
  state: NeedleState | undefined,
  snapshot: ScanSnapshot | null,
): Headline {
  if (!state) return { text: '准备中…', tone: 'pending' };
  if (state.firstHitConfirmed && state.firstHit !== null) {
    return {
      text:
        primaryDigits + ' 首次出现在 π 的小数点后第 ' + formatThousands(state.firstHit) + ' 位',
      tone: 'found',
    };
  }
  if (state.firstHit !== null) {
    return {
      text:
        '疑似第 ' + formatThousands(state.firstHit) + ' 位，正在补扫它前面的位数以确认（暂定）',
      tone: 'tentative',
    };
  }
  if (snapshot && snapshot.phase !== 'searching' && state.status === 'partial') {
    return {
      text:
        '已扫描范围内没有出现 ' +
        primaryDigits +
        '（中间有拉取失败的缺口，结论不完整）',
      tone: 'partial',
    };
  }
  if (snapshot && snapshot.phase !== 'searching') {
    return {
      text: primaryDigits + ' 没有出现在前 ' + formatCompact(snapshot.targetDigits) + ' 位小数里',
      tone: 'notfound',
    };
  }
  const scanned = snapshot ? formatCompact(snapshot.scannedDigits) : '0';
  return { text: '正在搜索 ' + primaryDigits + '（已扫描 ' + scanned + ' 位）', tone: 'searching' };
}

/**
 * 首屏脚注（表答案）：说清位次来自哪、深到多少，以及**本次实时扫描到底能复验到多深**。
 * 本机服务能到 10 亿位，在线演示版只有前 100 万位 —— 深处的位次不能吹成「会自己再验证一遍」。
 */
export function tableNote(knownThrough: number, reach: number, position: number): string {
  const head = '位次来自离线答案表（前 ' + formatCompact(knownThrough) + '位）';
  if (reach <= 0) return head + '；本次实时扫描不可用，没法在浏览器里复验';
  if (reach >= position) return head + '；下面的实时扫描会自己再验证一遍';
  return head + '；本次实时扫描只有前 ' + formatCompact(reach) + '位，这一位没法在浏览器里现场复验';
}

/**
 * 首屏换成别的写法时的脚注：1900–2100 里有几天的最长写法（8 位完整写法）在前 10 亿位内
 * 从未出现，首屏只好展示最先出现的那种写法 —— 这里说明为什么数字不对应用户第一眼找的写法。
 */
export function swappedNote(primaryDigits: string, knownThrough: number): string {
  return (
    '首屏显示的是最先出现的那种写法：' + primaryDigits + ' 这个完整写法在前 ' + formatCompact(knownThrough) + '位内没有出现'
  );
}

export interface HeroNumber {
  /** 巨型数字要显示的数值；null 表示现在还没有数字可显示 */
  value: number | null;
  /** position = 已找到的位置；scanned = 正在扫描的进度位数；none = 还没开始 */
  kind: 'position' | 'scanned' | 'none';
  /** 该数字是确认结论还是暂定 / 仍在搜索 */
  confirmed: boolean;
  tone: HeadlineTone;
}

/** 首屏巨型数字：找到就显示位次，没找到就显示实时扫描位数。 */
export function heroNumber(state: NeedleState | undefined, snapshot: ScanSnapshot | null): HeroNumber {
  if (state && state.firstHit !== null) {
    return {
      value: state.firstHit,
      kind: 'position',
      confirmed: state.firstHitConfirmed,
      tone: state.firstHitConfirmed ? 'found' : 'tentative',
    };
  }
  if (snapshot) {
    const tone: HeadlineTone =
      snapshot.phase === 'searching' ? 'searching' : state?.status === 'partial' ? 'partial' : 'notfound';
    return { value: snapshot.scannedDigits, kind: 'scanned', confirmed: false, tone };
  }
  if (state) return { value: null, kind: 'none', confirmed: false, tone: 'searching' };
  return { value: null, kind: 'none', confirmed: false, tone: 'pending' };
}

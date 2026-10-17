// 位次深度尺的纯计算：把 1 位到 10 亿位压进同一条对数刻度轨道。
// 线性刻度在这里没用 —— 大多数位次都在几百万以内，线性尺上根本挤在一起看不见。
import { withUnit } from './position';

export interface DepthTick {
  value: number;
  /** 在轨道上的位置（0–100） */
  percent: number;
  label: string;
}

/** 位次在 [1, depth] 对数刻度上的百分比（0–100）；非法输入一律折到边界。 */
export function logDepthPercent(position: number, depth: number): number {
  if (!Number.isFinite(depth) || depth <= 1) return 0;
  if (!Number.isFinite(position)) return 0;
  const clamped = Math.min(depth, Math.max(1, position));
  const percent = (Math.log10(clamped) / Math.log10(depth)) * 100;
  return Math.min(100, Math.max(0, percent));
}

/**
 * 刻度值：从 1 位起每 step 个数量级一站，末尾补上 depth 本身。
 * step 按深度取 3 / 2 / 1，保证刻度数不多于 5 个，窄屏也排得开。
 */
export function depthTicks(depth: number): DepthTick[] {
  if (!Number.isFinite(depth) || depth <= 1) {
    return [{ value: 1, percent: 0, label: withUnit(1, '位') }];
  }
  const decades = Math.log10(depth);
  const step = decades >= 8 ? 3 : decades >= 5 ? 2 : 1;
  const values: number[] = [];
  for (let decade = 0; decade <= decades + 1e-9; decade += step) {
    values.push(Math.round(10 ** decade));
  }
  if (values[values.length - 1] !== depth) values.push(depth);
  return values.map((value) => ({
    value,
    percent: logDepthPercent(value, depth),
    label: withUnit(value, '位'),
  }));
}

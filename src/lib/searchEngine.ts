// 分块、带覆盖水位的 π 位数搜索引擎。
// 设计要点：
//  - 从第 1 位开始**按顺序**申请分块（阶梯尺寸：64K → 512K → 1M → 4M），最多 concurrency 块在途；
//  - 每块向前多取 maxNeedleLen-1 位做跨块重叠，因此「起始位置落在本块 own 区间内」的出现，
//    一定且仅由本块完整发现（不会漏、不会重复计数）；
//  - 用 CoverageTracker 维护「从第 1 位起连续扫描到哪」，只有水位越过某个命中的起点+串长，
//    该命中才算**已确认**；否则只能标「暂定」；
//  - 所有写法都确认到首个命中即可停止（要找的就是最早出现位置）；
//  - 中间块失败只记缺口并重试，绝不据此宣称「未找到」。
import { CoverageTracker, findOccurrencesInText, type Needle, type Occurrence } from './searchCore';

export type Scanner = (
  text: string,
  windowStart: number,
  needles: Needle[],
  signal?: AbortSignal
) => Promise<Occurrence[]>;

export interface DigitSourceLike {
  /** 可用的最大位数（本数据源能取到的最深位置） */
  maxDigits: number;
  fetchRange(from: number, count: number, signal?: AbortSignal): Promise<string>;
}

/** 阶梯块尺寸（单位：位） */
export const CHUNK_LADDER = [64_000, 512_000, 1_000_000, 4_000_000];

export function chunkSizeAt(index: number): number {
  return CHUNK_LADDER[Math.min(Math.max(index, 0), CHUNK_LADDER.length - 1)];
}

export interface ChunkPlan {
  index: number;
  /** 本块「自己的」起始位（含） */
  ownStart: number;
  /** 本块「自己的」结束位（含） */
  ownEnd: number;
  /** 实际取回的起始位（含） */
  fetchStart: number;
  fetchCount: number;
  /** 下一块应从哪一位开始 */
  nextStart: number;
}

/**
 * 规划一块：own 区间决定「谁负责发现」，fetch 区间向前多取串长-1 位做跨块重叠。
 * 返回 null 表示已经没有可取的数据。
 */
export function planChunk(options: {
  ownStart: number;
  index: number;
  needleLen: number;
  targetDigits: number;
  availableDigits: number;
}): ChunkPlan | null {
  const { ownStart, index, needleLen, targetDigits, availableDigits } = options;
  const ownEnd = Math.min(targetDigits, ownStart + chunkSizeAt(index) - 1);
  const fetchStart = ownStart;
  const fetchEnd = Math.min(ownEnd + Math.max(needleLen, 1) - 1, availableDigits);
  if (fetchEnd < fetchStart) return null;
  return { index, ownStart, ownEnd, fetchStart, fetchCount: fetchEnd - fetchStart + 1, nextStart: ownEnd + 1 };
}

export type NeedleStatus = 'pending' | 'searching' | 'found' | 'not-found' | 'partial';

export interface NeedleState {
  id: string;
  digits: string;
  length: number;
  firstHit: number | null;
  firstHitConfirmed: boolean;
  occurrences: number;
  occurrencesConfirmed: number;
  status: NeedleStatus;
  /** 结论来自哪：'scan' = 本次实时扫描（默认），'table' = 离线预计算答案表 */
  origin?: 'scan' | 'table';
  /** 表答案覆盖到哪一位（只有 origin === 'table' 时有意义） */
  knownThrough?: number;
}

export type ScanPhase = 'searching' | 'done' | 'stopped' | 'error';

export interface ScanSnapshot {
  phase: ScanPhase;
  scannedDigits: number;
  checkedDigits: number;
  targetDigits: number;
  availableDigits: number;
  bytesFetched: number;
  chunksDone: number;
  elapsedMs: number;
  etaMs: number | null;
  gaps: Array<[number, number]>;
  needles: NeedleState[];
  error?: string;
}

export interface SearchRunOptions {
  needles: Needle[];
  source: DigitSourceLike;
  targetDigits: number;
  scanner: Scanner;
  concurrency?: number;
  /** 所有写法都确认到首个命中后即停止（默认 true） */
  stopWhenAllFound?: boolean;
  onUpdate?: (snapshot: ScanSnapshot) => void;
  now?: () => number;
}

interface NeedleTrack {
  needle: Needle;
  positions: Set<number>;
  firstHit: number | null;
}

const RETRIES_PER_CHUNK = 2;

export class PiSearchRun {
  readonly targetDigits: number;
  private readonly source: DigitSourceLike;
  private readonly scanner: Scanner;
  private readonly concurrency: number;
  private readonly stopWhenAllFound: boolean;
  private readonly onUpdate?: (snapshot: ScanSnapshot) => void;
  private readonly now: () => number;
  private readonly startedAt: number;
  private readonly tracker = new CoverageTracker();
  private readonly tracks = new Map<string, NeedleTrack>();
  private maxNeedleLen = 1;
  private aborted = false;
  private phase: ScanPhase = 'searching';
  private error?: string;
  private bytesFetched = 0;
  private chunksDone = 0;
  private gaps: Array<[number, number]> = [];

  constructor(options: SearchRunOptions) {
    this.source = options.source;
    this.scanner = options.scanner;
    this.targetDigits = Math.max(1, Math.min(options.targetDigits, Math.max(options.source.maxDigits, 1)));
    this.concurrency = Math.max(1, options.concurrency ?? 6);
    this.stopWhenAllFound = options.stopWhenAllFound !== false;
    this.onUpdate = options.onUpdate;
    this.now = options.now ?? (() => Date.now());
    this.startedAt = this.now();
    for (const needle of options.needles) {
      if (!needle.digits) continue;
      this.tracks.set(needle.id, { needle, positions: new Set(), firstHit: null });
      this.maxNeedleLen = Math.max(this.maxNeedleLen, needle.digits.length);
    }
  }

  stop(): void {
    this.aborted = true;
  }

  private list(): Needle[] {
    return [...this.tracks.values()].map((t) => t.needle);
  }

  /** 连续扫描到的位数（水位） */
  private get scannedDigits(): number {
    return Math.max(0, Math.min(this.tracker.contiguousThrough(1), this.source.maxDigits));
  }

  /**
   * 全局保守水位：所有写法都能确认到这里，只有这些位上的出现才被完整判定过（含跨块串长）。
   * 它按最长串算，所以对比它更短的串偏保守；单个写法自己确认到哪，见 stateFor 的按串长算法。
   */
  private get checkedDigits(): number {
    return Math.max(0, this.scannedDigits - (this.maxNeedleLen - 1));
  }

  private stateFor(track: NeedleTrack): NeedleState {
    const positions = [...track.positions];
    // 每个写法按自己的串长算确认水位：整段都落在已连续扫描的区间里就算确认。
    // 用全局最长串（8 位完整写法）会拖累 4 位写法，把明明已经看完的位次标成「暂定」。
    const confirmedLimit = Math.max(0, this.scannedDigits - (track.needle.digits.length - 1));
    const occurrencesConfirmed = positions.filter((p) => p <= confirmedLimit).length;
    const firstHit = track.firstHit;
    const firstHitConfirmed = firstHit !== null && firstHit <= confirmedLimit;
    // 只有「确实扫完了目标范围（或数据源尽头）且没有缺口」才允许说「未找到」
    const complete =
      this.gaps.length === 0 &&
      (this.scannedDigits >= this.targetDigits || this.scannedDigits >= this.source.maxDigits);
    let status: NeedleStatus;
    if (firstHitConfirmed) status = 'found';
    else if (firstHit !== null) status = 'searching';
    else if (this.phase === 'searching') status = 'searching';
    else if (complete) status = 'not-found';
    else if (this.gaps.length > 0 || this.phase === 'stopped') status = 'partial';
    else status = 'pending';
    return {
      id: track.needle.id,
      digits: track.needle.digits,
      length: track.needle.digits.length,
      firstHit,
      firstHitConfirmed,
      occurrences: positions.length,
      occurrencesConfirmed,
      status,
    };
  }

  snapshot(): ScanSnapshot {
    const elapsedMs = this.now() - this.startedAt;
    const scanned = this.scannedDigits;
    const remaining = Math.max(0, this.targetDigits - scanned);
    const etaMs = scanned > 200_000 && remaining > 0 ? Math.round((elapsedMs / scanned) * remaining) : null;
    return {
      phase: this.phase,
      scannedDigits: scanned,
      checkedDigits: this.checkedDigits,
      targetDigits: this.targetDigits,
      availableDigits: this.source.maxDigits,
      bytesFetched: this.bytesFetched,
      chunksDone: this.chunksDone,
      elapsedMs,
      etaMs,
      gaps: this.gaps.map(([a, b]) => [a, b] as [number, number]),
      needles: [...this.tracks.values()].map((t) => this.stateFor(t)),
      error: this.error,
    };
  }

  private emit(): void {
    this.onUpdate?.(this.snapshot());
  }

  private record(occurrences: Occurrence[]): void {
    for (const hit of occurrences) {
      const track = this.tracks.get(hit.id);
      if (!track) continue;
      track.positions.add(hit.position);
      if (track.firstHit === null || hit.position < track.firstHit) track.firstHit = hit.position;
    }
    this.chunksDone++;
    this.emit();
  }

  private async runChunk(plan: ChunkPlan): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRIES_PER_CHUNK + 1; attempt++) {
      if (this.aborted) return;
      try {
        const text = await this.source.fetchRange(plan.fetchStart, plan.fetchCount, undefined);
        if (this.aborted) return;
        if (text.length === 0) throw new Error('取回空数据（块 ' + plan.index + '）');
        let occurrences: Occurrence[];
        try {
          occurrences = await this.scanner(text, plan.fetchStart, this.list());
        } catch (scanError) {
          // Worker 不可用时退回主线程扫描，不因扫描器故障丢数据
          occurrences = findOccurrencesInText(text, plan.fetchStart, this.list());
          void scanError;
        }
        if (this.aborted) return;
        this.bytesFetched += text.length;
        this.tracker.add(plan.fetchStart, plan.fetchStart + text.length - 1);
        // own 区间内的出现才归属本块；跨到块尾的串已因「向前多取串长-1 位」而完整包含在本块文本里
        const fetchEnd = plan.fetchStart + text.length - 1;
        const ownHits = occurrences.filter((o) => {
          const track = this.tracks.get(o.id);
          const len = track ? track.needle.digits.length : 1;
          return o.position >= plan.ownStart && o.position + len - 1 <= fetchEnd;
        });
        this.record(ownHits);
        return;
      } catch (error) {
        lastError = error;
        if (attempt <= RETRIES_PER_CHUNK) await new Promise((r) => setTimeout(r, 300 * attempt));
      }
    }
    this.gaps.push([plan.ownStart, plan.ownEnd]);
    this.chunksDone++;
    this.error = lastError instanceof Error ? lastError.message : String(lastError);
    this.emit();
  }

  async start(): Promise<ScanSnapshot> {
    if (this.tracks.size === 0) {
      this.phase = 'done';
      this.emit();
      return this.snapshot();
    }
    this.emit();
    const inflight = new Set<Promise<void>>();
    let nextStart = 1;
    let index = 0;

    const shouldContinue = (): boolean => {
      if (this.aborted) return false;
      if (this.scannedDigits >= this.targetDigits && inflight.size === 0) return false;
      if (this.stopWhenAllFound && this.allFirstHitsConfirmed()) return false;
      return true;
    };

    const launch = (): boolean => {
      if (nextStart > this.targetDigits) return false;
      const plan = planChunk({
        ownStart: nextStart,
        index,
        needleLen: this.maxNeedleLen,
        targetDigits: this.targetDigits,
        availableDigits: this.source.maxDigits,
      });
      if (!plan) return false;
      nextStart = plan.nextStart;
      index++;
      const promise = this.runChunk(plan).finally(() => {
        inflight.delete(promise);
        this.emit();
      });
      inflight.add(promise);
      return true;
    };

    while (shouldContinue()) {
      while (inflight.size < this.concurrency && shouldContinue() && launch()) {
        /* 灌满在途窗口 */
      }
      if (inflight.size === 0) break;
      await Promise.race(inflight);
    }

    await Promise.allSettled([...inflight]);

    if (this.aborted) this.phase = 'stopped';
    else if (this.chunksDone === 0 && this.gaps.length > 0) this.phase = 'error';
    else this.phase = 'done';
    for (const track of this.tracks.values()) {
      // 收尾：若所有数据源都扫完仍无命中且无缺口，保持 not-found 语义（stateFor 已处理）
      if (track.firstHit === null && this.gaps.length > 0) track.positions.clear();
    }
    this.emit();
    return this.snapshot();
  }

  private allFirstHitsConfirmed(): boolean {
    // 提前停止用全局水位（最保守的那种）；这里晚停几块只是多扫一点，不会误判
    const limit = this.checkedDigits;
    for (const track of this.tracks.values()) {
      if (track.firstHit === null || track.firstHit > limit) return false;
    }
    return this.tracks.size > 0;
  }
}
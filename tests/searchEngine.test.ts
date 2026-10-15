import { describe, expect, it } from 'vitest';
import { findOccurrencesInText, type Needle } from '../src/lib/searchCore';
import {
  PiSearchRun,
  type DigitSourceLike,
  type ScanSnapshot,
  type Scanner,
} from '../src/lib/searchEngine';

/** 用内存字符串冒充 π 数据源；可注入延时与失败，用来构造乱序与缺口 */
class FakeSource implements DigitSourceLike {
  readonly calls: Array<[number, number]> = [];
  constructor(
    readonly text: string,
    private readonly delay: (from: number, count: number) => number = () => 0,
    private readonly fail: (from: number) => boolean = () => false
  ) {}
  get maxDigits(): number {
    return this.text.length;
  }
  async fetchRange(from: number, count: number, _signal?: AbortSignal): Promise<string> {
    this.calls.push([from, count]);
    const wait = this.delay(from, count);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (this.fail(from)) throw new Error('模拟上游失败：' + from);
    return this.text.slice(from - 1, from - 1 + count);
  }
}

const scanner: Scanner = async (text, windowStart, needles, _signal) =>
  findOccurrencesInText(text, windowStart, needles);

const thrower: Scanner = async () => {
  throw new Error('Worker 挂了');
};

function zeros(length: number): string {
  return '0'.repeat(length);
}

/** 在 1-based 位次 position 处打入 needle */
function put(text: string, position: number, needle: string): string {
  return text.slice(0, position - 1) + needle + text.slice(position - 1 + needle.length);
}

const needle = (digits: string): Needle[] => [{ id: digits, digits }];

function run(
  source: FakeSource,
  needles: Needle[],
  target: number,
  extra: { concurrency?: number; scanner?: Scanner; onUpdate?: (snapshot: ScanSnapshot) => void } = {}
): PiSearchRun {
  return new PiSearchRun({
    needles,
    source,
    targetDigits: target,
    scanner: extra.scanner ?? scanner,
    concurrency: extra.concurrency ?? 1,
    onUpdate: extra.onUpdate,
  });
}

describe('跨块重叠', () => {
  it('起始位正好是块尾的串也能被发现（多取的串长-1 位）', async () => {
    const source = new FakeSource(put(zeros(200_000), 64_000, '77777777'));
    const state = await run(source, needle('77777777'), 200_000).start();
    expect(state.needles[0].firstHit).toBe(64_000);
    expect(state.needles[0].firstHitConfirmed).toBe(true);
    expect(state.needles[0].status).toBe('found');
    expect(source.calls.length).toBe(1);
  });

  it('跨过块边界的长串由后一块发现', async () => {
    const text = put(zeros(200_000), 64_001, '88888888');
    const source = new FakeSource(text);
    const state = await run(source, needle('88888888'), 200_000).start();
    expect(state.needles[0].firstHit).toBe(64_001);
    expect(state.needles[0].status).toBe('found');
  });

  it('同时搜多条不同长度的串', async () => {
    let text = zeros(300_000);
    text = put(text, 63_999, '1111');
    text = put(text, 70_000, '999999999999');
    const state = await run(new FakeSource(text), needle('1111').concat(needle('999999999999')), 300_000).start();
    const byId = new Map(state.needles.map((n) => [n.id, n]));
    expect(byId.get('1111')?.firstHit).toBe(63_999);
    expect(byId.get('1111')?.status).toBe('found');
    expect(byId.get('999999999999')?.firstHit).toBe(70_000);
    expect(byId.get('999999999999')?.status).toBe('found');
  });
});

describe('水位与确认', () => {
  it('后一块先返回时命中只能是暂定，前一块补上后才确认', async () => {
    const source = new FakeSource(put(zeros(130_000), 100_000, '66666666'), (from) => (from === 1 ? 300 : 0));
    const snapshots: ScanSnapshot[] = [];
    const state = await run(source, needle('66666666'), 130_000, {
      concurrency: 2,
      onUpdate: (snapshot) => snapshots.push(snapshot),
    }).start();
    const tentative = snapshots.filter(
      (s) => s.needles[0].firstHit === 100_000 && s.needles[0].firstHitConfirmed === false
    );
    expect(tentative.length).toBeGreaterThan(0);
    expect(tentative[0].needles[0].status).toBe('searching');
    expect(state.needles[0].firstHitConfirmed).toBe(true);
    expect(state.needles[0].status).toBe('found');
  });

  it('水位没越过命中起点时不算找到', async () => {
    const source = new FakeSource(put(zeros(130_000), 100_000, '66666666'), (from) => (from === 1 ? 300 : 0));
    const run1 = run(source, needle('66666666'), 130_000, { concurrency: 2 });
    const results: boolean[] = [];
    const original = source.fetchRange.bind(source);
    source.fetchRange = async (from, count, signal) => {
      const text = await original(from, count, signal);
      if (from > 1) results.push(run1.snapshot().needles[0].firstHitConfirmed);
      return text;
    };
    await run1.start();
    expect(results.some((confirmed) => confirmed === false)).toBe(true);
  });

  it('每个写法按自己的串长算确认水位，不被更长的写法拖累', async () => {
    let text = zeros(200_000);
    // 两条 6 位串之间空出两位，避免相邻的同数字串被切成滑窗重叠的多个命中
    text = put(text, 63_994, '222222');
    text = put(text, 64_002, '222222');
    text = put(text, 64_008, '1111');
    text = put(text, 70_000, '999999999999');
    const snapshots: ScanSnapshot[] = [];
    const state = await run(
      new FakeSource(text),
      needle('1111').concat(needle('222222'), needle('999999999999')),
      200_000,
      { onUpdate: (snapshot) => snapshots.push(snapshot) }
    ).start();
    // 第 0 块取回 64_000 + (12 - 1) = 64_011 位。全局水位 = 64_011 - 11 = 64_000（保守），
    // 但 4 位写法自己的水位是 64_011 - 3 = 64_008，落在它里面的命中都算确认。
    const firstBlock = snapshots.find((snapshot) => snapshot.scannedDigits === 64_011);
    expect(firstBlock).toBeTruthy();
    expect(firstBlock?.checkedDigits).toBe(64_000);
    const early = new Map((firstBlock?.needles ?? []).map((n) => [n.id, n]));
    expect(early.get('1111')?.firstHit).toBe(64_008);
    expect(early.get('1111')?.firstHitConfirmed).toBe(true);
    expect(early.get('222222')?.occurrences).toBe(2);
    expect(early.get('222222')?.occurrencesConfirmed).toBe(2);
    const finalById = new Map(state.needles.map((n) => [n.id, n]));
    expect(finalById.get('1111')?.status).toBe('found');
    expect(finalById.get('222222')?.status).toBe('found');
    expect(finalById.get('999999999999')?.firstHit).toBe(70_000);
  });
});

describe('缺口与未找到', () => {
  it('中间块失败只记缺口，绝不判「未找到」', async () => {
    const source = new FakeSource(
      put(zeros(400_000), 300_000, '12121212'),
      () => 0,
      (from) => from === 64_001
    );
    const state = await run(source, needle('12121212'), 400_000).start();
    expect(state.phase).toBe('done');
    expect(state.gaps).toEqual([[64_001, 400_000]]);
    // 第 0 块实际取回了 64_007 位（含跨块重叠），水位只到那里
    expect(state.scannedDigits).toBe(64_007);
    expect(state.needles[0].status).toBe('partial');
    expect(state.needles[0].firstHit).toBeNull();
    expect(state.error).toBeTruthy();
  }, 15_000);

  it('真扫完且没有缺口才说「未找到」', async () => {
    const source = new FakeSource(zeros(100_000));
    const state = await run(source, needle('12345678'), 100_000).start();
    expect(state.phase).toBe('done');
    expect(state.gaps).toEqual([]);
    expect(state.scannedDigits).toBe(100_000);
    expect(state.needles[0].status).toBe('not-found');
    expect(state.needles[0].firstHit).toBeNull();
  });

  it('中途停止不会报「未找到」', async () => {
    const source = new FakeSource(zeros(2_000_000), (from) => (from > 500_000 ? 400 : 20));
    const search = run(source, needle('12345678'), 2_000_000);
    const timer = setTimeout(() => search.stop(), 150);
    const state = await search.start();
    clearTimeout(timer);
    expect(state.phase).toBe('stopped');
    expect(state.needles[0].status).toBe('partial');
    expect(state.scannedDigits).toBeLessThan(state.targetDigits);
  });

  it('全部命中后提前停止，不会白扫剩下的位', async () => {
    const source = new FakeSource(put(zeros(5_000_000), 5, '20261014'));
    const state = await run(source, needle('20261014'), 5_000_000).start();
    expect(state.needles[0].firstHit).toBe(5);
    expect(source.calls.length).toBe(1);
    expect(state.bytesFetched).toBeLessThan(100_000);
  });

  it('扫描器异常时退回主线程，不丢数据', async () => {
    const source = new FakeSource(put(zeros(100_000), 42, '4321'));
    const state = await run(source, needle('4321'), 100_000, { scanner: thrower }).start();
    expect(state.needles[0].firstHit).toBe(42);
    expect(state.needles[0].status).toBe('found');
  });

  it('目标被数据源长度截断', async () => {
    const source = new FakeSource(put(zeros(100_000), 50, '55555555'));
    const state = await run(source, needle('55555555'), 1_000_000).start();
    expect(state.targetDigits).toBe(100_000);
    expect(state.availableDigits).toBe(100_000);
    expect(state.needles[0].status).toBe('found');
  });
});

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SiteNav, type NavItem } from './components/SiteNav';
import { HeroStage } from './components/sections/HeroStage';
import { FormsChapter } from './components/sections/FormsChapter';
import { DigitsChapter } from './components/sections/DigitsChapter';
import { EngineChapter } from './components/sections/EngineChapter';
import { PickDateChapter } from './components/sections/PickDateChapter';
import { TrustChapter } from './components/sections/TrustChapter';
import { SiteFooter } from './components/sections/SiteFooter';
import { useNow } from './hooks/useNow';
import { useActiveSection } from './hooks/useActiveSection';
import { useSectionPaging } from './hooks/useSectionPaging';
import { encodingsFor, searchNeedles } from './lib/encodings';
import { findOccurrencesInText } from './lib/searchCore';
import { PiSearchRun, type ScanSnapshot, type Scanner } from './lib/searchEngine';
import { probeSource, remoteWindowRange, type DigitSource } from './lib/digitSource';
import { createScanPool, type ScanPool } from './lib/workerScanner';
import { clearCache, loadCache, saveCache, type CachedResult } from './lib/resultCache';
import { clampDateKey, formatCompact, formatThousands, pad2, parseDateKey, toDateKey, withDateParam } from './lib/position';
import { ANSWER_RANGE, lookupAnswers, mergeAnswers, type DateAnswers } from './lib/answers';
import { pickDisplayNeedle } from './lib/present';
import type { DigitsStripProps, StripWriting } from './components/DigitsStrip';
import type { SelfCheckState } from './components/Conventions';

const PRESET_TARGETS = [100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000];
/** 首屏默认只扫到 1000 万位：六种写法里的四种都能在这个范围内给出结论。 */
const INITIAL_TARGET = 10_000_000;
/** #engine 里的深搜 CTA：8 位写法只在这两个范围里才有结论。 */
const DEEP_TARGETS = [100_000_000, 1_000_000_000];

const NAV_ITEMS: NavItem[] = [
  { id: 'hero', label: '开始' },
  { id: 'forms', label: '六种写法' },
  { id: 'digits', label: '在 π 的哪里' },
  { id: 'engine', label: '怎么找的' },
  { id: 'pick', label: '换一天' },
  { id: 'trust', label: '口径与来源' },
];
const SECTION_IDS = NAV_ITEMS.map((item) => item.id);

type StripState = Omit<DigitsStripProps, 'needle' | 'animate'> & { writing: StripWriting | null };

const IDLE_STRIP: StripState = {
  status: 'idle',
  from: null,
  digits: null,
  position: null,
  writing: null,
  message: '正在准备扫描…',
};

/** ?date=YYYY-MM-DD 深链：非法值忽略。 */
function readDateParam(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = new URLSearchParams(window.location.search).get('date');
    return value && parseDateKey(value) ? value : null;
  } catch {
    return null;
  }
}

export default function App() {
  const now = useNow(1000);
  const todayKey = toDateKey(now);

  const [selectedKey, setSelectedKey] = useState<string | null>(readDateParam);
  // 可选范围就是离线答案表的覆盖范围：越界（旧链接、手改地址栏）一律夹回边界，
  // 免得页面在这张表之外悄悄降级成「只扫到前 100 万位」的样子
  const activeKey = clampDateKey(selectedKey ?? todayKey, ANSWER_RANGE.minKey, ANSWER_RANGE.maxKey);
  const isToday = activeKey === todayKey;
  const date = useMemo(() => parseDateKey(activeKey) ?? new Date(), [activeKey]);

  const encodings = useMemo(() => encodingsFor(date), [date]);
  const needles = useMemo(() => searchNeedles(encodings), [encodings]);
  const needleKey = needles.map((needle) => needle.digits).join(',');
  const primaryDigits = encodings[0].digits;

  const [source, setSource] = useState<DigitSource | null>(null);
  const [snapshot, setSnapshot] = useState<ScanSnapshot | null>(null);
  const [targetOverride, setTargetOverride] = useState<number | null>(INITIAL_TARGET);
  const [runToken, setRunToken] = useState(0);
  const [cache, setCache] = useState<Record<string, CachedResult>>({});
  const [strip, setStrip] = useState<StripState>(IDLE_STRIP);
  const [selfCheck, setSelfCheck] = useState<SelfCheckState>({ status: 'idle' });
  const [showExtras, setShowExtras] = useState(false);
  const [workers, setWorkers] = useState(1);
  // 离线预计算答案表：静态站也能给出十亿位深度的位次；取不到就只靠实时扫描
  const [answers, setAnswers] = useState<DateAnswers | null>(null);
  // 当前这份 answers 属于哪一天（YYYY-MM-DD）；取表成功或失败都写上，换日期时先清空。
  // 首屏靠它避免「先报另一种写法的暂定位次、表一到又整个换掉」的跳变，
  // 也避免换日期的那一帧把上一天的表答案并进这一天的 needles。
  const [answersDate, setAnswersDate] = useState<string | null>(null);

  const poolRef = useRef<ScanPool | null>(null);
  const runRef = useRef<PiSearchRun | null>(null);
  const runIdRef = useRef(0);
  const persistedRef = useRef<Set<string>>(new Set());

  const activeSection = useActiveSection(SECTION_IDS);
  // 整页滚动吸附：滚轮落在章节边界时一次翻一整段（长章节先原生滚到底）
  useSectionPaging(SECTION_IDS);

  // 0) 地址栏跟随当前日期：换一天后的链接可以直接分享，浏览器前进 / 后退也能走
  //    首次同步用 replaceState（深链进来不改历史），之后每次换日期 pushState
  const urlSyncedRef = useRef(false);
  useEffect(() => {
    const next = withDateParam(window.location.href, activeKey, todayKey);
    if (next !== window.location.href) {
      if (urlSyncedRef.current) window.history.pushState(null, '', next);
      else window.history.replaceState(null, '', next);
    }
    urlSyncedRef.current = true;
  }, [activeKey, todayKey]);

  // 0.1) 浏览器前进 / 后退：按地址栏里的 ?date= 重新取一天（没有参数就是今天）
  useEffect(() => {
    const onPopState = () => setSelectedKey(readDateParam());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // 0) 深链：#forms / #digits … 直接定位到章节（截图与分享用），不等入场动画
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, '');
    if (!id) return;
    const node = document.getElementById(id);
    if (node) node.scrollIntoView({ block: 'start' });
  }, []);

  // 1) 每日期一份结果缓存（localStorage）
  useEffect(() => {
    setCache(loadCache(activeKey));
    persistedRef.current = new Set();
  }, [activeKey]);

  // 1.5) 预计算答案表：按日期取表，失败（表没生成 / 格式变了 / 网络问题）就退回纯实时扫描
  useEffect(() => {
    let alive = true;
    setAnswers(null);
    setAnswersDate(null);
    lookupAnswers(date.getFullYear(), date.getMonth() + 1, date.getDate()).then(
      (value) => {
        if (alive) {
          setAnswers(value);
          setAnswersDate(activeKey);
        }
      },
      () => {
        // 表没生成 / 格式不认识 / 网络失败：这一轮就当没有表，首屏回到实时扫描的答案
        if (alive) {
          setAnswers(null);
          setAnswersDate(activeKey);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [date, activeKey]);

  // 2) Worker 池
  useEffect(() => {
    const pool = createScanPool();
    poolRef.current = pool;
    setWorkers(pool ? pool.size : 1);
    return () => {
      pool?.dispose();
      poolRef.current = null;
    };
  }, []);

  // 3) 探测数据源：优先本机 /api，其次静态 pi-1m.txt
  useEffect(() => {
    let alive = true;
    probeSource().then((next) => {
      if (alive) setSource(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  const maxTarget = source?.maxDigits ?? 1_000_000;
  const targetDigits = Math.min(targetOverride ?? maxTarget, maxTarget);
  // 首屏脚注要承诺「实时扫描能复验到多深」：用的是这一轮扫描的目标深度，而不是数据源容量 ——
  // 本机服务虽然够到 10 亿位，默认这一轮只扫到 1000 万位，深处的位次不能吹成「会自己再验证一遍」
  const scanReach = source && source.kind !== 'unavailable' ? targetDigits : 0;
  const presets = useMemo(() => PRESET_TARGETS.filter((value) => value <= maxTarget), [maxTarget]);

  // 4) 搜索引擎：日期 / 上限 / 手动重跑变化时重启
  useEffect(() => {
    if (!source || source.kind === 'unavailable' || needles.length === 0) {
      setSnapshot(null);
      return;
    }
    const myRun = ++runIdRef.current;
    const pool = poolRef.current;
    const scanner: Scanner = pool
      ? pool.scanner
      : async (text, windowStart, list) => findOccurrencesInText(text, windowStart, list);
    const run = new PiSearchRun({
      needles: needles.map((needle) => ({ id: needle.id, digits: needle.digits })),
      source,
      targetDigits,
      scanner,
      concurrency: pool ? Math.max(3, pool.size) : 2,
      onUpdate: (snap) => {
        if (runIdRef.current !== myRun) return;
        setSnapshot(snap);
        for (const needle of snap.needles) {
          if (!needle.firstHitConfirmed || needle.firstHit === null) continue;
          const key = activeKey + '|' + needle.digits;
          if (persistedRef.current.has(key)) continue;
          persistedRef.current.add(key);
          saveCache(activeKey, needle.digits, {
            position: needle.firstHit,
            scannedThrough: snap.checkedDigits,
            checkedAt: Date.now(),
          });
          setCache(loadCache(activeKey));
        }
      },
    });
    runRef.current = run;
    setSnapshot(run.snapshot());
    void run.start();
    return () => {
      run.stop();
      runRef.current = null;
    };
  }, [source, needleKey, targetDigits, runToken, activeKey, needles]);

  // 只认「属于当前这一天」的表答案：换日期的那一帧 answers 还停在上一天，不能拿来合并
  const tableForDate = answers && answersDate === activeKey ? answers : null;
  // 表这一轮有没有结果（成功或失败都算有）：没有就说明还在路上
  const tableWaiting = answersDate !== activeKey;

  // 表答案 + 实时扫描：needle 结论以表为准（origin: 'table'），进度字段保持实时扫描的语义
  const view = useMemo<ScanSnapshot | null>(() => {
    if (!tableForDate) return snapshot;
    const base: ScanSnapshot = snapshot ?? {
      phase: 'searching',
      scannedDigits: 0,
      checkedDigits: 0,
      targetDigits,
      availableDigits: Math.max(tableForDate.depth, targetDigits),
      bytesFetched: 0,
      chunksDone: 0,
      elapsedMs: 0,
      etaMs: null,
      gaps: [],
      needles: [],
    };
    return { ...base, needles: mergeAnswers(base.needles, tableForDate) };
  }, [snapshot, tableForDate, targetDigits]);

  const primaryState = view?.needles.find((needle) => needle.digits === primaryDigits);

  // 首屏主写法（8 位）在 1000 万位内往往还没出现，所以数字带优先展示「这一天里最早确认命中的写法」，
  // 有确认命中就用确认的，其次才用暂定的，都没有才显示说明文案。
  const displayNeedle = useMemo(
    () =>
      view
        ? pickDisplayNeedle(
            view.needles,
            primaryDigits,
            (digits) => encodings.find((encoding) => encoding.digits === digits)?.label ?? digits,
          )
        : null,
    [view, encodings, primaryDigits],
  );

  // 首屏的位次：表这一轮有结论（或确认取不到、只能靠实时扫描）时才拿出来。
  // 表还在路上时首屏不报「别的写法」的暂定答案 —— 那个答案几帧后就会被表整条替换掉。
  const heroAnswer = tableWaiting ? null : displayNeedle;

  const displayDigits = displayNeedle ? displayNeedle.digits : null;
  const displayPosition = displayNeedle ? displayNeedle.position : null;
  const displayLabel = displayNeedle ? displayNeedle.label : '';
  const displayTentative = displayNeedle ? displayNeedle.tentative : false;

  // 5) 命中位置附近的数字（高亮展示）
  useEffect(() => {
    if (!source || source.kind === 'unavailable') {
      setStrip(IDLE_STRIP);
      return;
    }
    if (displayDigits === null || displayPosition === null) {
      setStrip({
        status: 'idle',
        from: null,
        digits: null,
        position: null,
        writing: null,
        message:
          primaryDigits +
          ' 在已扫描的范围内还没有确认的位次 —— 可以到下一章深搜到 1 亿 / 10 亿位，或者换一天试试。',
      });
      return;
    }
    const before = 40;
    const length = displayDigits.length;
    const from = Math.max(1, displayPosition - before);
    const writing: StripWriting = { label: displayLabel, digits: displayDigits, tentative: displayTentative };
    // 位次（表答案常常在几亿位）可能超出当前数据源能取到的范围：
    // 有在线取数能力时（静态版 + api.pi.delivery）取回命中点附近的一小段，否则诚实说明取不到
    if (from > source.maxDigits) {
      const remote = source.remote;
      const span = remote
        ? remoteWindowRange(displayPosition, length, before, remote.maxPerRequest, remote.maxDigits)
        : null;
      if (remote && span) {
        let alive = true;
        setStrip({ status: 'loading', from: null, digits: null, position: displayPosition, writing });
        remote.fetchDigits(span.from, span.count).then(
          (digits) => {
            if (!alive) return;
            setStrip({
              status: 'ready',
              from: span.from,
              digits,
              position: displayPosition,
              writing,
              note:
                '这一段取自 ' +
                remote.label +
                '（本站内置副本只到前 ' +
                formatCompact(source.maxDigits) +
                '位）；位次结论仍以离线预计算表为准。',
            });
          },
          (error: unknown) => {
            if (!alive) return;
            setStrip({
              status: 'idle',
              from: null,
              digits: null,
              position: displayPosition,
              writing,
              message:
                '它落在小数点后第 ' +
                formatThousands(displayPosition) +
                ' 位，超出本站内置的前 ' +
                formatCompact(source.maxDigits) +
                ' 位，在线取数也没能取回附近的数字（' +
                String((error as Error)?.message ?? error) +
                '）。在本机跑 pnpm dev 可以直接从本地 π 数据里取。',
            });
          },
        );
        return () => {
          alive = false;
        };
      }
      setStrip({
        status: 'idle',
        from: null,
        digits: null,
        position: displayPosition,
        writing,
        message:
          '它落在小数点后第 ' +
          formatThousands(displayPosition) +
          ' 位，而当前数据源只到前 ' +
          formatCompact(source.maxDigits) +
          ' 位 —— 附近的数字取不回来。在本机跑 pnpm dev 可以取到实位。',
      });
      return;
    }
    const count = Math.min(before * 2 + length, source.maxDigits - from + 1);
    let alive = true;
    setStrip({ status: 'loading', from: null, digits: null, position: displayPosition, writing });
    source.fetchRange(from, count).then(
      (digits) => {
        if (!alive) return;
        setStrip({ status: 'ready', from, digits, position: displayPosition, writing });
      },
      (error: unknown) => {
        if (!alive) return;
        setStrip({
          status: 'error',
          from: null,
          digits: null,
          position: displayPosition,
          writing,
          message: String((error as Error)?.message ?? error),
        });
      },
    );
    return () => {
      alive = false;
    };
  }, [source, displayDigits, displayPosition, displayLabel, displayTentative, primaryDigits]);

  // 6) 数据自检：第 762 位起应为 999999
  useEffect(() => {
    if (!source || source.kind === 'unavailable') return;
    let alive = true;
    setSelfCheck({ status: 'checking' });
    source.fetchRange(762, 6).then(
      (digits) => {
        if (!alive) return;
        setSelfCheck(
          digits === '999999' ? { status: 'ok', got: digits } : { status: 'bad', got: digits, message: '期望 999999' },
        );
      },
      (error: unknown) => {
        if (!alive) return;
        setSelfCheck({ status: 'bad', message: String((error as Error)?.message ?? error) });
      },
    );
    return () => {
      alive = false;
    };
  }, [source]);

  const running = snapshot?.phase === 'searching';

  const handleStep = useCallback(
    (days: number) => {
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
      setSelectedKey(clampDateKey(toDateKey(next), ANSWER_RANGE.minKey, ANSWER_RANGE.maxKey));
    },
    [date],
  );

  const handleRandom = useCallback(() => {
    const start = Date.parse(ANSWER_RANGE.minKey + 'T00:00:00Z');
    const end = Date.parse(ANSWER_RANGE.maxKey + 'T00:00:00Z');
    const random = new Date(start + Math.random() * (end - start));
    setSelectedKey(random.getUTCFullYear() + '-' + pad2(random.getUTCMonth() + 1) + '-' + pad2(random.getUTCDate()));
  }, []);

  const handleClearCache = useCallback(() => {
    clearCache(activeKey);
    setCache({});
    persistedRef.current = new Set();
    setRunToken((token) => token + 1);
  }, [activeKey]);

  const deepTargets = useMemo(() => DEEP_TARGETS.filter((value) => value <= maxTarget), [maxTarget]);

  return (
    <div className="app">
      <SiteNav items={NAV_ITEMS} active={activeSection} hidden={activeSection === 'hero'} />

      <HeroStage
        now={now}
        date={date}
        isToday={isToday}
        primaryDigits={primaryDigits}
        primaryState={primaryState}
        snapshot={view}
        source={source}
        scanReach={scanReach}
        answer={heroAnswer}
      />

      <main className="flow">
        {source?.kind === 'unavailable' ? (
          <p className="notice notice-bad">
            没有可用的 π 数据源：本机服务未启动，且站点自带的 <code>public/pi-1m.txt</code> 读取失败（可执行{' '}
            <code>pnpm fetch-fallback</code> 重新生成）。位次结论仍来自离线预计算表，但实时扫描与数字带暂时不可用。
          </p>
        ) : null}

        <FormsChapter
          encodings={encodings}
          snapshot={view}
          cache={cache}
          showExtras={showExtras}
          onToggleExtras={() => setShowExtras((value) => !value)}
        />

        <DigitsChapter {...strip} needle={displayDigits ?? primaryDigits} />

        <EngineChapter
          snapshot={snapshot}
          source={source}
          workers={workers}
          targetDigits={targetDigits}
          presets={presets.length > 0 ? presets : [maxTarget]}
          running={running}
          onTargetChange={(value) => setTargetOverride(value)}
          onStop={() => runRef.current?.stop()}
          onRestart={() => setRunToken((token) => token + 1)}
          onClearCache={handleClearCache}
          deepTargets={deepTargets}
        />

        <PickDateChapter
          dateKey={activeKey}
          isToday={isToday}
          min={ANSWER_RANGE.minKey}
          max={ANSWER_RANGE.maxKey}
          onChange={(key) => {
            if (parseDateKey(key)) setSelectedKey(key);
          }}
          onStep={handleStep}
          onToday={() => setSelectedKey(null)}
          onRandom={handleRandom}
          encodings={encodings}
          snapshot={view}
          cache={cache}
        />

        <TrustChapter selfCheck={selfCheck} sourceKind={source?.kind ?? 'unknown'} />
      </main>

      <SiteFooter
        scanned={snapshot?.scannedDigits ?? 0}
        target={targetDigits}
        sourceLabel={source ? source.label : '正在探测数据源…'}
      />
    </div>
  );
}

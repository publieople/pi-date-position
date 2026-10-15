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
import { probeSource, type DigitSource } from './lib/digitSource';
import { createScanPool, type ScanPool } from './lib/workerScanner';
import { clearCache, loadCache, saveCache, type CachedResult } from './lib/resultCache';
import { formatCompact, pad2, parseDateKey, toDateKey } from './lib/position';
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
  const activeKey = selectedKey ?? todayKey;
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

  const poolRef = useRef<ScanPool | null>(null);
  const runRef = useRef<PiSearchRun | null>(null);
  const runIdRef = useRef(0);
  const persistedRef = useRef<Set<string>>(new Set());

  const activeSection = useActiveSection(SECTION_IDS);
  // 整页滚动吸附：滚轮落在章节边界时一次翻一整段（长章节先原生滚到底）
  useSectionPaging(SECTION_IDS);

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

  const primaryState = snapshot?.needles.find((needle) => needle.digits === primaryDigits);

  // 首屏主写法（8 位）在 1000 万位内往往还没出现，所以数字带优先展示「这一天里最早确认命中的写法」，
  // 有确认命中就用确认的，其次才用暂定的，都没有才显示说明文案。
  const displayNeedle = useMemo(() => {
    if (!snapshot) return null;
    const pick = (digits: string) => {
      const state = snapshot.needles.find((needle) => needle.digits === digits);
      if (!state || state.firstHit === null) return null;
      return {
        digits,
        position: state.firstHit,
        tentative: !state.firstHitConfirmed,
        label: encodings.find((encoding) => encoding.digits === digits)?.label ?? digits,
      };
    };
    const direct = pick(primaryDigits);
    // 主写法（8 位）确认了就用它；否则取「已确认写法里位次最靠前的那个」。
    if (direct && !direct.tentative) return direct;
    const confirmed = needles
      .map((needle) => pick(needle.digits))
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null && !candidate.tentative);
    if (confirmed.length > 0) {
      return confirmed.reduce((best, candidate) => (candidate.position < best.position ? candidate : best));
    }
    if (direct) return direct;
    for (const needle of needles) {
      const candidate = pick(needle.digits);
      if (candidate) return candidate;
    }
    return null;
  }, [snapshot, encodings, needles, primaryDigits]);

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
    const count = Math.min(before * 2 + length, source.maxDigits - from + 1);
    const writing: StripWriting = { label: displayLabel, digits: displayDigits, tentative: displayTentative };
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
      setSelectedKey(toDateKey(next));
    },
    [date],
  );

  const handleRandom = useCallback(() => {
    const start = Date.UTC(1980, 0, 1);
    const end = Date.UTC(2035, 11, 31);
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
        snapshot={snapshot}
        source={source}
        answer={displayNeedle}
      />

      <main className="flow">
        {source?.kind === 'static' ? (
          <p className="notice">
            在线演示版只有站点自带的前 {formatCompact(source.maxDigits)} 位静态数据，所以 8 位写法若在前{' '}
            {formatCompact(source.maxDigits)} 位内没有出现就无法给出结论。想看小数点后 10 亿位：把仓库 clone 到本机，
            执行 <code>pnpm install</code> 后运行 <code>pnpm dev</code>，本机服务会按 4,000,000 字节一块去取 MIT 的 π 文件。
          </p>
        ) : null}

        {source?.kind === 'unavailable' ? (
          <p className="notice notice-bad">
            没有可用的 π 数据源：本机服务未启动，且站点自带的 <code>public/pi-1m.txt</code> 读取失败（可执行{' '}
            <code>pnpm fetch-fallback</code> 重新生成）。
          </p>
        ) : null}

        <FormsChapter
          encodings={encodings}
          snapshot={snapshot}
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
          onChange={(key) => {
            if (parseDateKey(key)) setSelectedKey(key);
          }}
          onStep={handleStep}
          onToday={() => setSelectedKey(null)}
          onRandom={handleRandom}
          encodings={encodings}
          snapshot={snapshot}
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

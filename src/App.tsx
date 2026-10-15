import { useMemo, useState } from 'react';
import { SiteNav, type NavItem } from './components/SiteNav';
import { DataSourceNotice } from './components/DataSourceNotice';
import { HeroStage } from './components/sections/HeroStage';
import { FormsChapter } from './components/sections/FormsChapter';
import { DigitsChapter } from './components/sections/DigitsChapter';
import { EngineChapter } from './components/sections/EngineChapter';
import { PickDateChapter } from './components/sections/PickDateChapter';
import { TrustChapter } from './components/sections/TrustChapter';
import { SiteFooter } from './components/sections/SiteFooter';
import { useActiveSection } from './hooks/useActiveSection';
import { useAnswersForDate } from './hooks/useAnswersForDate';
import { useDateSelection } from './hooks/useDateSelection';
import { useDigitsStrip } from './hooks/useDigitsStrip';
import { useInitialHash } from './hooks/useInitialHash';
import { usePiSource, useScanPool } from './hooks/usePiSource';
import { useCopyLink } from './hooks/useCopyLink';
import { useSearchSession } from './hooks/useSearchSession';
import { useSectionPaging } from './hooks/useSectionPaging';
import { useSelfCheck } from './hooks/useSelfCheck';
import { ANSWER_RANGE, composeView } from './lib/answers';
import { parseDateKey, withDateParam } from './lib/position';
import { pickDisplayNeedle } from './lib/present';

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

/**
 * 页面本体只做三件事：组合各个 hook 的状态、把「实时扫描 + 离线答案表」合成一份视图、
 * 把视图分发给各章节。具体逻辑分别在：
 *   hooks/useDateSelection   日期选择 + 地址栏同步
 *   hooks/usePiSource        数据源探测 / Worker 池
 *   hooks/useAnswersForDate  按日期取离线答案表
 *   hooks/useSearchSession   实时扫描会话 + 结果缓存
 *   hooks/useDigitsStrip     命中位置附近的数字
 *   hooks/useSelfCheck       费曼点自检
 *   lib/answers composeView  表答案并进扫描快照
 */
export default function App() {
  const { now, todayKey, activeKey, isToday, date, encodings, needles, needleKey, primaryDigits, select, step, random } =
    useDateSelection();
  useInitialHash();
  const activeSection = useActiveSection(SECTION_IDS);
  // 整页滚动吸附：滚轮落在章节边界时一次翻一整段（长章节先原生滚到底）
  useSectionPaging(SECTION_IDS);

  // #pick 里的「复制链接」：复制的是与地址栏同一套规则的分享链接（今天不带 ?date=）
  const share = useCopyLink(() => withDateParam(window.location.href, activeKey, todayKey));

  const source = usePiSource();
  const { poolRef, workers } = useScanPool();
  const table = useAnswersForDate(date, activeKey);

  const [targetOverride, setTargetOverride] = useState<number | null>(INITIAL_TARGET);
  const [showExtras, setShowExtras] = useState(false);

  const maxTarget = source?.maxDigits ?? 1_000_000;
  const targetDigits = Math.min(targetOverride ?? maxTarget, maxTarget);
  // 首屏脚注要承诺「实时扫描能复验到多深」：用的是这一轮扫描的目标深度，而不是数据源容量 ——
  // 本机服务虽然够到 10 亿位，默认这一轮只扫到 1000 万位，深处的位次不能吹成「会自己再验证一遍」
  const scanReach = source && source.kind !== 'unavailable' ? targetDigits : 0;

  const { snapshot, runRef, cache, restart, clearCachedResults } = useSearchSession({
    source,
    needles,
    needleKey,
    targetDigits,
    activeKey,
    poolRef,
  });

  // 表答案 + 实时扫描：needle 结论以表为准（origin: 'table'），进度字段保持实时扫描的语义
  const view = useMemo(() => composeView(snapshot, table.table, targetDigits), [snapshot, table.table, targetDigits]);
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
  const heroAnswer = table.waiting ? null : displayNeedle;
  const displayDigits = displayNeedle ? displayNeedle.digits : null;
  const displayPosition = displayNeedle ? displayNeedle.position : null;

  const strip = useDigitsStrip({
    source,
    digits: displayDigits,
    position: displayPosition,
    label: displayNeedle ? displayNeedle.label : '',
    tentative: displayNeedle ? displayNeedle.tentative : false,
    primaryDigits,
  });
  const selfCheck = useSelfCheck(source);

  const presets = useMemo(() => PRESET_TARGETS.filter((value) => value <= maxTarget), [maxTarget]);
  const deepTargets = useMemo(() => DEEP_TARGETS.filter((value) => value <= maxTarget), [maxTarget]);
  const running = snapshot?.phase === 'searching';

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
        <DataSourceNotice sourceKind={source?.kind ?? 'unknown'} answersMissing={table.missing} />

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
          onRestart={restart}
          onClearCache={clearCachedResults}
          deepTargets={deepTargets}
        />

        <PickDateChapter
          dateKey={activeKey}
          isToday={isToday}
          min={ANSWER_RANGE.minKey}
          max={ANSWER_RANGE.maxKey}
          onChange={(key) => {
            if (parseDateKey(key)) select(key);
          }}
          onStep={step}
          onToday={() => select(null)}
          onRandom={random}
          copyState={share.state}
          onCopyLink={share.copy}
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

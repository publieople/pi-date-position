import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DepthScale } from './components/DepthScale';
import { DigitBand } from './components/DigitBand';
import { EncodingLedger } from './components/EncodingLedger';
import { Hero } from './components/Hero';
import { IconArrowDown, IconRefresh } from './components/Icons';
import { Masthead } from './components/Masthead';
import { MethodColophon } from './components/MethodColophon';
import { ShareDialog } from './components/ShareDialog';
import { YearAtlas } from './components/YearAtlas';
import { depthOf, loadManifest, loadYear, readingsFor } from './lib/answers';
import { copyText } from './lib/clipboard';
import { addDays, clampDate, compareDate, todayParts } from './lib/date';
import { readInitialState, writeParams } from './lib/params';
import { pageTitle, shareText } from './lib/share';
import { useTheme } from './lib/theme';
import { useReveal } from './lib/useReveal';
import type { DateParts, Manifest, SlotId, YearAnswers } from './lib/types';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '读取失败，请稍后再试';
}

export default function App() {
  const initial = useMemo(readInitialState, []);
  const [date, setDate] = useState<DateParts>(initial.date);
  const [slot, setSlot] = useState<SlotId>(initial.slot);
  const [pinned, setPinned] = useState(initial.pinned);
  const [today, setToday] = useState<DateParts>(todayParts);
  const [theme, toggleTheme] = useTheme();
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [yearData, setYearData] = useState<YearAnswers | null>(null);
  const [yearLoading, setYearLoading] = useState(true);
  const [yearError, setYearError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setToday((previous) => {
        const next = todayParts();
        return compareDate(previous, next) === 0 ? previous : next;
      });
    };
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pinned) {
      setDate((previous) => (compareDate(previous, today) === 0 ? previous : today));
    }
  }, [today, pinned]);

  useEffect(() => {
    let alive = true;
    loadManifest()
      .then((next) => {
        if (alive) {
          setManifest(next);
        }
      })
      .catch(() => {
        if (alive) {
          setManifest(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    setYearLoading(true);
    setYearError(null);
    loadYear(date.year)
      .then((next) => {
        if (alive) {
          setYearData(next);
          setYearLoading(false);
        }
      })
      .catch((nextError) => {
        if (alive) {
          setYearData(null);
          setYearError(errorMessage(nextError));
          setYearLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [date.year, reloadKey]);

  useEffect(() => {
    writeParams(date, slot, pinned);
  }, [date, slot, pinned]);

  const readings = useMemo(
    () => (yearData && yearData.year === date.year ? readingsFor(yearData, date) : []),
    [yearData, date],
  );
  const reading = useMemo(() => readings.find((item) => item.slot === slot) || null, [readings, slot]);
  const depth = depthOf(manifest, yearData);
  const loading = yearLoading || !yearData || yearData.year !== date.year;

  useEffect(() => {
    document.title = pageTitle(date, reading);
  }, [date, reading]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="description"]');
    if (meta && reading) {
      meta.setAttribute('content', shareText(date, reading, depth));
    }
  }, [date, reading, depth]);

  const chooseDate = useCallback((next: DateParts) => {
    setDate(clampDate(next));
    setPinned(true);
  }, []);

  const moveDay = useCallback((delta: number) => {
    setDate((previous) => clampDate(addDays(previous, delta)));
    setPinned(true);
  }, []);

  const goToday = useCallback(() => {
    setDate(todayParts());
    setPinned(false);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyText(shareText(date, reading, depth));
    if (!ok) {
      return;
    }
    setCopied(true);
    if (copyTimer.current !== null) {
      window.clearTimeout(copyTimer.current);
    }
    copyTimer.current = window.setTimeout(() => {
      setCopied(false);
      copyTimer.current = null;
    }, 1800);
  }, [date, reading, depth]);

  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) {
        window.clearTimeout(copyTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && target.closest('input, textarea, select, [contenteditable="true"], dialog, [role="grid"]')) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveDay(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveDay(1);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        document.getElementById('encodings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        goToday();
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        setShareOpen(true);
      } else if (event.key === '/') {
        event.preventDefault();
        document.getElementById('date-jump')?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveDay, goToday]);

  useReveal([yearError]);

  return (
    <>
      <a className="skip-link" href="#main">
        跳到正文
      </a>
      <Masthead
        date={date}
        reading={reading}
        theme={theme}
        pinned={pinned}
        onThemeToggle={toggleTheme}
        onDateChange={chooseDate}
        onToday={goToday}
        onShare={() => setShareOpen(true)}
      />

      <main id="main" className="main">
        {yearError ? (
          <section className="fatal" role="alert" aria-labelledby="fatal-title">
            <p className="eyebrow">读取失败</p>
            <h1 id="fatal-title">答案表没有读出来</h1>
            <p className="fatal__message">{yearError}</p>
            <div className="fatal__actions">
              <button className="button button--primary" type="button" onClick={() => setReloadKey((key) => key + 1)}>
                <IconRefresh size={17} /> 再试一次
              </button>
              <a className="button button--quiet" href="./answers/manifest.json" target="_blank" rel="noreferrer">
                查看答案表清单
              </a>
            </div>
            <p className="fatal__hint">
              站点是纯静态的。检查 <code>public/answers/{date.year}.json</code> 是否存在，或刷新页面重试。
            </p>
          </section>
        ) : (
          <>
            <Hero
              date={date}
              readings={readings}
              reading={reading}
              loading={loading}
              depth={depth}
              copied={copied}
              onSelectSlot={setSlot}
              onPrev={() => moveDay(-1)}
              onNext={() => moveDay(1)}
              onToday={goToday}
              onShare={() => setShareOpen(true)}
              onCopy={handleCopy}
            />

            <a className="scroll-cue" href="#encodings">
              向下看六种写法 <IconArrowDown size={15} />
            </a>

            <EncodingLedger
              date={date}
              readings={readings}
              loading={loading}
              selectedSlot={reading?.slot || null}
              depth={depth}
              onSelect={setSlot}
            />

            <DigitBand reading={reading} depth={depth} />

            <DepthScale
              readings={readings}
              selectedSlot={reading?.slot || null}
              depth={depth}
              loading={loading}
              missing={manifest?.missing ?? 6}
              onSelect={setSlot}
            />

            <YearAtlas date={date} slot={slot} onSelectDate={chooseDate} onSelectSlot={setSlot} />

            <MethodColophon manifest={manifest} depth={depth} />
          </>
        )}
      </main>

      <footer className="footer">
        <div className="footer__inner">
          <p className="footer__brand">
            π 日签 <span className="mono">THE PI ALMANAC</span>
          </p>
          <p className="footer__meta">1900–2100 · 10 亿位 · 纯静态</p>
          <p className="footer__meta mono">ONE SMALL RITUAL, EVERY DAY</p>
        </div>
      </footer>

      <ShareDialog
        open={shareOpen}
        date={date}
        reading={reading}
        slot={slot}
        depth={depth}
        onClose={() => setShareOpen(false)}
      />
    </>
  );
}


import { useEffect, useState } from 'react';
import { IconCalendar, IconMoon, IconShare, IconSun } from './Icons';
import { MAX_DATE, MIN_DATE, formatCn, parseISODate, toDateKey } from '../lib/date';
import { formatNumber } from '../lib/format';
import type { DateParts, Reading } from '../lib/types';
import type { Theme } from '../lib/theme';

interface MastheadProps {
  date: DateParts;
  reading: Reading | null;
  theme: Theme;
  pinned: boolean;
  onThemeToggle: () => void;
  onDateChange: (date: DateParts) => void;
  onToday: () => void;
  onShare: () => void;
}

export function Masthead({
  date,
  reading,
  theme,
  pinned,
  onThemeToggle,
  onDateChange,
  onToday,
  onShare,
}: MastheadProps) {
  const [compacted, setCompacted] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompacted(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={'masthead' + (compacted ? ' is-compact' : '')}>
      <div className="masthead__inner">
        <a className="masthead__brand" href="#today" aria-label="π 日签 THE PI ALMANAC，回到今天">
          <span className="masthead__pi" aria-hidden="true">
            π
          </span>
          <span className="masthead__wordmark">
            日签
            <small>THE PI ALMANAC</small>
          </span>
        </a>

        <div className="masthead__tools">
          <div className="masthead__reading" aria-live="polite">
            {reading ? (
              <>
                <span className="mono masthead__reading-label">{reading.label}</span>
                <strong className="masthead__reading-value">
                  {reading.position === null ? '未出现' : '第 ' + formatNumber(reading.position) + ' 位'}
                </strong>
              </>
            ) : (
              <span className="masthead__reading-value">读取中</span>
            )}
          </div>

          <label className="masthead__date" htmlFor="date-jump">
            <span className="sr-only">选择日期（1900 至 2100 年）</span>
            <IconCalendar size={16} />
            <input
              id="date-jump"
              type="date"
              min={toDateKey(MIN_DATE)}
              max={toDateKey(MAX_DATE)}
              value={toDateKey(date)}
              aria-label={'当前日期 ' + formatCn(date) + '，可更改'}
              onChange={(event) => {
                const next = parseISODate(event.target.value);
                if (next) {
                  onDateChange(next);
                }
              }}
            />
          </label>

          <nav className="masthead__nav" aria-label="页面目录">
            <a href="#today">今天</a>
            <a href="#encodings">六种写法</a>
            <a href="#digits">数字带</a>
            <a href="#scale">深度</a>
            <a href="#atlas">图集</a>
            <a href="#method">方法</a>
          </nav>

          {pinned ? (
            <button className="masthead__today" type="button" onClick={onToday}>
              回到今天
            </button>
          ) : null}

          <button
            className="icon-button"
            type="button"
            onClick={onThemeToggle}
            aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
            title={theme === 'light' ? '深色主题' : '浅色主题'}
          >
            {theme === 'light' ? <IconMoon size={17} /> : <IconSun size={17} />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={onShare}
            disabled={!reading}
            aria-label="分享这一天"
            title="分享"
          >
            <IconShare size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

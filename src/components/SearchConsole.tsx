import type { ScanSnapshot } from '../lib/searchEngine';
import type { DigitSource } from '../lib/digitSource';
import { formatCompact, formatDuration, formatThousands } from '../lib/position';

export interface SearchConsoleProps {
  snapshot: ScanSnapshot | null;
  source: DigitSource | null;
  workers: number;
  targetDigits: number;
  presets: number[];
  running: boolean;
  onTargetChange: (value: number) => void;
  onStop: () => void;
  onRestart: () => void;
  onClearCache: () => void;
  /** 深搜 CTA（例如 1 亿 / 10 亿位） */
  deepTargets?: number[];
}

export function SearchConsole({
  snapshot,
  source,
  workers,
  targetDigits,
  presets,
  running,
  onTargetChange,
  onStop,
  onRestart,
  onClearCache,
  deepTargets,
}: SearchConsoleProps) {
  const scanned = snapshot?.scannedDigits ?? 0;
  const target = snapshot?.targetDigits ?? targetDigits;
  const percent = target > 0 ? Math.min(100, (scanned / target) * 100) : 0;
  const gaps = snapshot?.gaps ?? [];
  return (
    <section className="console">
      <div className="console-head">
        <h3>实时扫描数据</h3>
        <div className="console-actions">
          {running ? (
            <button type="button" onClick={onStop}>
              停止
            </button>
          ) : null}
          <button type="button" onClick={onRestart}>
            重新搜索
          </button>
          <button type="button" className="btn-ghost" onClick={onClearCache}>
            清空本机记录
          </button>
        </div>
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-label={'实时扫描进度：前 ' + formatCompact(target) + '位'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
      >
        <div className="bar-fill" style={{ width: percent.toFixed(2) + '%' }} />
      </div>
      <dl className="console-grid">
        <div>
          <dt>已扫描位数</dt>
          <dd>
            {formatThousands(scanned)} <span className="dim">/ {formatCompact(target)}</span>
          </dd>
        </div>
        <div>
          <dt>进度</dt>
          <dd>{percent < 0.01 && percent > 0 ? '<0.01' : percent.toFixed(2)}%</dd>
        </div>
        <div>
          <dt>从上游取回</dt>
          <dd>{formatCompact(snapshot?.bytesFetched ?? 0)} 字节</dd>
        </div>
        <div>
          <dt>分块完成</dt>
          <dd>{formatThousands(snapshot?.chunksDone ?? 0)} 块</dd>
        </div>
        <div>
          <dt>用时</dt>
          <dd>{formatDuration(snapshot?.elapsedMs ?? 0)}</dd>
        </div>
        <div>
          <dt>预计剩余</dt>
          <dd>{running ? formatDuration(snapshot?.etaMs ?? null) : '—'}</dd>
        </div>
        <div>
          <dt>扫描线程</dt>
          <dd>{workers} 个 Worker</dd>
        </div>
        <div>
          <dt>数据源</dt>
          <dd className="dim">{source?.label ?? '探测中…'}</dd>
        </div>
      </dl>
      <div className="console-deep">
        <label>
          <span>深搜上限</span>
          <select value={String(targetDigits)} onChange={(event) => onTargetChange(Number(event.target.value))}>
            {presets.map((preset) => (
              <option key={preset} value={String(preset)}>
                前 {formatCompact(preset)} 位
              </option>
            ))}
          </select>
        </label>
        <span className="dim">
          {source?.kind === 'server'
            ? '上限受数据源限制（本机服务 10 亿位）。已确认首个出现的写法会提前停止。'
            : source?.kind === 'static'
              ? '在线演示版只有前 ' +
                formatCompact(source.maxDigits) +
                ' 位静态数据。已确认首个出现的写法会提前停止。'
              : '正在探测数据源…'}
        </span>
      </div>
      {deepTargets && deepTargets.length > 0 ? (
        <div className="deep-actions">
          <span className="dim">直接深搜：</span>
          {deepTargets.map((value) => (
            <button
              key={value}
              type="button"
              className={'btn-chip' + (targetDigits === value ? ' btn-chip-on' : '')}
              onClick={() => onTargetChange(value)}
              disabled={targetDigits === value}
            >
              前 {formatCompact(value)} 位
            </button>
          ))}
          <span className="dim">深搜更慢：8 位完整写法往往要到这个范围里才有结论。</span>
        </div>
      ) : null}
      {gaps.length > 0 ? (
        <p className="console-warn">
          有 {gaps.length} 段区间拉取失败（
          {gaps.slice(0, 3).map(([a, b]) => formatThousands(a) + '–' + formatThousands(b)).join('、')}
          {gaps.length > 3 ? ' 等' : ''}
          ），这些位置没有被扫描过，因此不能据此断言「没有出现」。
        </p>
      ) : null}
      {snapshot?.phase === 'error' ? <p className="console-warn">上游出错：{snapshot.error}</p> : null}
    </section>
  );
}

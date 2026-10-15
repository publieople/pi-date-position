import type { Encoding } from '../lib/encodings';
import type { NeedleState } from '../lib/searchEngine';
import type { CachedResult } from '../lib/resultCache';
import { describePosition, formatCompact, formatThousands } from '../lib/position';

export interface EncodingCardProps {
  encoding: Encoding;
  needleId: string;
  state: NeedleState | undefined;
  cached: CachedResult | undefined;
  active: boolean;
  /** full = #forms 里的大卡片；compact = #pick 里的紧凑一行 */
  variant?: 'full' | 'compact';
  onToggle?: () => void;
}

export const STATUS_TEXT: Record<NeedleState['status'], string> = {
  pending: '准备中',
  searching: '搜索中',
  found: '已确认',
  'not-found': '范围内未出现',
  partial: '未扫完（有缺口或已停止）',
};

export function EncodingCard({
  encoding,
  state,
  cached,
  active,
  variant = 'full',
  onToggle,
}: EncodingCardProps) {
  const found = state?.firstHit ?? null;
  const confirmed = Boolean(state?.firstHitConfirmed);
  // 结论来自离线预计算表（覆盖整个十亿位深度）时，措辞要跟实时扫描区分开
  const fromTable = state?.origin === 'table';
  const depthLabel = state?.knownThrough ? formatCompact(state.knownThrough) : '';
  const statusClass = state
    ? state.status === 'found'
      ? 'ok'
      : state.status === 'partial'
        ? 'warn'
        : state.status === 'not-found'
          ? 'bad'
          : 'busy'
    : 'busy';
  const statusText = state
    ? fromTable
      ? state.status === 'found'
        ? '已确认（预计算表）'
        : depthLabel + '位内未出现'
      : STATUS_TEXT[state.status]
    : '准备中';

  if (variant === 'compact') {
    return (
      <article className={'mini' + (active ? ' mini-active' : '')}>
        <span className="mini-label">{encoding.label}</span>
        <span className="mini-digits">{encoding.digits}</span>
        <span className={'mini-status status-' + statusClass}>
          <span className="dot" />
          {found !== null ? describePosition(found) : statusText}
          {found !== null && !confirmed ? <span className="chip chip-warn">暂定</span> : null}
        </span>
      </article>
    );
  }

  return (
    <article className={'card' + (active ? ' card-active' : '') + (encoding.sameAs ? ' card-muted' : '')}>
      <div className="card-head">
        <span className="card-label">{encoding.label}</span>
        {encoding.sameAs ? <span className="chip chip-dim">数字串同 {encoding.sameAs}</span> : null}
        {active ? <span className="chip">深搜</span> : null}
      </div>
      <div className="card-digits">{encoding.digits}</div>
      <div className="card-hint">{encoding.hint}</div>
      <div className={'card-status status-' + statusClass}>
        <span className="dot" />
        {statusText}
        {found !== null ? <span className="card-pos">{describePosition(found)}</span> : null}
        {found !== null && !confirmed ? <span className="chip chip-warn">暂定</span> : null}
      </div>
      <dl className="card-meta">
        {fromTable ? (
          <>
            <div>
              <dt>{depthLabel}位内出现</dt>
              <dd>{formatThousands(state?.occurrences ?? 0)} 次</dd>
            </div>
            <div>
              <dt>结论范围</dt>
              <dd>前 {depthLabel} 位</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt>已扫描范围内出现</dt>
              <dd>{state ? formatThousands(state.occurrences) + ' 次' : '—'}</dd>
            </div>
            <div>
              <dt>其中已确认</dt>
              <dd>{state ? formatThousands(state.occurrencesConfirmed) + ' 次' : '—'}</dd>
            </div>
          </>
        )}
      </dl>
      {cached ? (
        <div className="card-cache">
          上次记录：第 {formatThousands(cached.position)} 位（已验证到 {formatThousands(cached.scannedThrough)} 位）
        </div>
      ) : null}
      {onToggle ? (
        <button type="button" className="link-btn" onClick={onToggle}>
          {active ? '取消深搜这一写法' : '加入深搜'}
        </button>
      ) : null}
    </article>
  );
}

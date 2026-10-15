import type { CopyState } from '../lib/share';

export interface DatePickerProps {
  dateKey: string;
  isToday: boolean;
  min: string;
  max: string;
  onChange: (key: string) => void;
  onStep: (days: number) => void;
  onToday: () => void;
  onRandom: () => void;
  /** 复制当前这一天的分享链接 */
  copyState: CopyState;
  onCopyLink: () => void;
}

const COPY_LABEL: Record<CopyState, string> = {
  idle: '复制链接',
  copied: '已复制 ✓',
  failed: '复制失败',
};

const COPY_LIVE: Record<CopyState, string> = {
  idle: '',
  copied: '这一天的链接已复制到剪贴板',
  failed: '复制失败，可以手动复制地址栏里的链接',
};

export function DatePicker({
  dateKey,
  isToday,
  min,
  max,
  onChange,
  onStep,
  onToday,
  onRandom,
  copyState,
  onCopyLink,
}: DatePickerProps) {
  return (
    <section className="picker">
      <label className="picker-field">
        <span>选一天</span>
        <input type="date" value={dateKey} min={min} max={max} onChange={(event) => onChange(event.target.value)} />
      </label>
      <p className="picker-hint">
        可选范围 {min} 至 {max} —— 离线答案表覆盖的每一天都已预先扫到前 10 亿位。换到哪一天，地址栏就记下哪一天。
      </p>
      <div className="picker-actions">
        <button type="button" onClick={() => onStep(-1)}>
          ← 前一天
        </button>
        <button type="button" onClick={() => onStep(1)}>
          后一天 →
        </button>
        <button type="button" className={isToday ? 'btn-primary' : ''} onClick={onToday} disabled={isToday}>
          回到今天
        </button>
        <button type="button" onClick={onRandom}>
          随机一天
        </button>
        <button type="button" className={copyState === 'copied' ? 'btn-primary' : ''} onClick={onCopyLink}>
          {COPY_LABEL[copyState]}
        </button>
        <span className="sr-only" aria-live="polite">
          {COPY_LIVE[copyState]}
        </span>
      </div>
    </section>
  );
}

export interface DatePickerProps {
  dateKey: string;
  isToday: boolean;
  onChange: (key: string) => void;
  onStep: (days: number) => void;
  onToday: () => void;
  onRandom: () => void;
}

export function DatePicker({ dateKey, isToday, onChange, onStep, onToday, onRandom }: DatePickerProps) {
  return (
    <section className="picker">
      <label className="picker-field">
        <span>选一天</span>
        <input type="date" value={dateKey} onChange={(event) => onChange(event.target.value)} />
      </label>
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
      </div>
    </section>
  );
}

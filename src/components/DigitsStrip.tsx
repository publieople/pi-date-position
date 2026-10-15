/** 当前数字带展示的是哪一种写法（可能与首屏主写法不同）。 */
export interface StripWriting {
  label: string;
  digits: string;
  tentative: boolean;
}

export interface DigitsStripProps {
  from: number | null;
  digits: string | null;
  needle: string;
  position: number | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  /** 数据来源说明（例如某段数字取自哪个上游） */
  note?: string;
  /** #digits 章节专用：整条自左滑入 + 命中片段逐位点亮（每位 30ms） */
  animate?: boolean;
}

export function DigitsStrip({
  from,
  digits,
  needle,
  position,
  status,
  message,
  note,
  animate = false,
}: DigitsStripProps) {
  if (status === 'idle') {
    return (
      <section className="strip">
        <p className="strip-msg">{message ?? '还没有可以展示的位次。'}</p>
      </section>
    );
  }
  if (status === 'loading') {
    return (
      <section className="strip">
        <p className="strip-msg">正在取命中位置附近的数字…</p>
      </section>
    );
  }
  if (status === 'error' || !digits || from === null) {
    return (
      <section className="strip">
        <p className="strip-msg strip-err">{message ?? '取数失败'}</p>
      </section>
    );
  }
  const offset = position === null ? -1 : position - from;
  const before = offset >= 0 ? digits.slice(0, offset) : '';
  const hit = offset >= 0 ? digits.slice(offset, offset + needle.length) : '';
  const after = offset >= 0 ? digits.slice(offset + needle.length) : digits;
  return (
    <section className="strip">
      <div className="strip-head">
        <span>π 的小数点后</span>
        <span className="strip-range">
          第 {from.toLocaleString('en-US')} 位起 {digits.length} 位
        </span>
      </div>
      <div className={'strip-body' + (animate ? ' strip-animate' : '')}>
        <span className="dim">…</span>
        <span>{before}</span>
        {hit ? (
          <mark>
            {animate
              ? hit.split('').map((char, index) => (
                  <span key={index} className="strip-lit" style={{ animationDelay: index * 30 + 'ms' }}>
                    {char}
                  </span>
                ))
              : hit}
          </mark>
        ) : null}
        <span>{after}</span>
        <span className="dim">…</span>
      </div>
      {position !== null ? (
        <p className="strip-foot">
          高亮的就是 <code>{needle}</code>，起点在小数点后第 {position.toLocaleString('en-US')} 位。
        </p>
      ) : null}
      {note ? <p className="strip-note">{note}</p> : null}
    </section>
  );
}

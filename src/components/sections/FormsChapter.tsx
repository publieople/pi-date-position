import type { Encoding } from '../../lib/encodings';
import type { CachedResult } from '../../lib/resultCache';
import type { NeedleState, ScanSnapshot } from '../../lib/searchEngine';
import { EncodingCard } from '../EncodingCard';
import { Reveal, Section } from '../Section';

export interface FormsChapterProps {
  encodings: Encoding[];
  snapshot: ScanSnapshot | null;
  cache: Record<string, CachedResult>;
  showExtras: boolean;
  onToggleExtras: () => void;
}

/** 六种（+ 两种带分隔符）写法的成绩单。 */
export function FormsChapter({
  encodings,
  snapshot,
  cache,
  showExtras,
  onToggleExtras,
}: FormsChapterProps) {
  const primary = encodings.filter((encoding) => encoding.group === 'primary');
  const visible = showExtras ? encodings : primary;
  const extraCount = encodings.length - primary.length;
  return (
    <Section
      id="forms"
      eyebrow="一个日期，六种写法"
      title="同一串数字，六种写法"
      lead="年月日、月日、日月、两位年、美国写法、欧洲写法 —— 每一种都是一串数字，在 π 里各自有它第一次出现的位置。"
    >
      <div className="card-grid">
        {visible.map((encoding, index) => {
          const state: NeedleState | undefined = snapshot?.needles.find(
            (needle) => needle.digits === encoding.digits,
          );
          return (
            <Reveal key={encoding.id} index={index} step={90} className="card-slot">
              <EncodingCard
                encoding={encoding}
                needleId={encoding.digits}
                state={state}
                cached={cache[encoding.digits]}
                active={encoding.group === 'primary'}
              />
            </Reveal>
          );
        })}
      </div>
      {extraCount > 0 ? (
        <Reveal index={visible.length} step={90} className="cards-toggle">
          <button type="button" className="btn-ghost" onClick={onToggleExtras}>
            {showExtras ? '收起带分隔符写法' : '展开带分隔符写法（' + extraCount + ' 种）'}
          </button>
          <span className="dim">带分隔符写法与前 6 种通常是同一串数字，结果共用。</span>
        </Reveal>
      ) : null}
    </Section>
  );
}

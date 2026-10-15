import type { Encoding } from '../../lib/encodings';
import type { CachedResult } from '../../lib/resultCache';
import type { ScanSnapshot } from '../../lib/searchEngine';
import type { CopyState } from '../../lib/share';
import { DatePicker } from '../DatePicker';
import { EncodingCard } from '../EncodingCard';
import { Reveal, Section } from '../Section';

export interface PickDateChapterProps {
  dateKey: string;
  isToday: boolean;
  min: string;
  max: string;
  onChange: (key: string) => void;
  onStep: (days: number) => void;
  onToday: () => void;
  onRandom: () => void;
  copyState: CopyState;
  onCopyLink: () => void;
  encodings: Encoding[];
  snapshot: ScanSnapshot | null;
  cache: Record<string, CachedResult>;
}

/** 换一天：日期选择 + 所选日期六种写法的紧凑结果。 */
export function PickDateChapter({
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
  encodings,
  snapshot,
  cache,
}: PickDateChapterProps) {
  const primary = encodings.filter((encoding) => encoding.group === 'primary');
  return (
    <Section
      id="pick"
      eyebrow="换一天"
      title="换一天，六种写法全都换位置"
      lead="日期一变，六串数字和它们在 π 里的位次都会完全变掉。"
    >
      <Reveal index={0}>
        <DatePicker
          dateKey={dateKey}
          isToday={isToday}
          min={min}
          max={max}
          onChange={onChange}
          onStep={onStep}
          onToday={onToday}
          onRandom={onRandom}
          copyState={copyState}
          onCopyLink={onCopyLink}
        />
      </Reveal>
      <Reveal index={1} step={120} className="mini-wrap">
        <div className="mini-list">
          {primary.map((encoding) => (
            <EncodingCard
              key={encoding.id}
              variant="compact"
              encoding={encoding}
              needleId={encoding.digits}
              state={snapshot?.needles.find((needle) => needle.digits === encoding.digits)}
              cached={cache[encoding.digits]}
              active
            />
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

import { DigitsStrip, type DigitsStripProps, type StripWriting } from '../DigitsStrip';
import { Reveal, Section } from '../Section';

export type DigitsChapterProps = Omit<DigitsStripProps, 'animate'> & {
  /** 当前数字带展示的是哪一种写法；null = 还没有任何确认的位次 */
  writing: StripWriting | null;
};

/** 背景数字流用的一段 π（小数点后 250 位，标准值）。 */
const RAIN =
  '14159265358979323846264338327950288419716939937510' +
  '58209749445923078164062862089986280348253421170679' +
  '82148086513282306647093844609550582231725359408128' +
  '48111745028410270193852110555964462294895493038196' +
  '44288109756659334461284756482337867831652712019091';

export function DigitsChapter({
  from,
  digits,
  needle,
  position,
  status,
  message,
  writing,
}: DigitsChapterProps) {
  return (
    <Section
      id="digits"
      eyebrow="它在 π 的哪里"
      title="把那一小段挖出来"
      lead="命中位置前后各 40 位，高亮的就是这个日期。"
    >
      <div className="digit-rain" aria-hidden="true">
        <div className="digit-rain-inner">
          <span>{RAIN.repeat(4)}</span>
          <span>{RAIN.repeat(4)}</span>
        </div>
      </div>
      <Reveal className="digits-body">
        {writing ? (
          <p className="digits-note">
            当前展示：<code>{writing.label}</code> <code>{writing.digits}</code>
            {writing.tentative ? '（暂定位置）' : ''}
            {status === 'ready' ? ' —— 它是这一天在已扫描范围内最早确认命中的写法。' : ' —— 正在取回它周围的数字。'}
          </p>
        ) : null}
        <DigitsStrip
          from={from}
          digits={digits}
          needle={needle}
          position={position}
          status={status}
          message={message}
          animate
        />
      </Reveal>
    </Section>
  );
}

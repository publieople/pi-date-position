import { Conventions, type SelfCheckState } from '../Conventions';
import { Reveal, Section } from '../Section';

export interface TrustChapterProps {
  selfCheck: SelfCheckState;
  sourceKind: string;
}

/** 口径、数据来源、自检。 */
export function TrustChapter({ selfCheck, sourceKind }: TrustChapterProps) {
  return (
    <Section
      id="trust"
      eyebrow="可信度"
      title="口径、来源与自检"
      lead="结论要能复核：位置口径写清楚，数据来源指得出来，并且每次打开页面都现场自检一次。"
    >
      <Reveal index={0}>
        <Conventions selfCheck={selfCheck} sourceKind={sourceKind} />
      </Reveal>
    </Section>
  );
}

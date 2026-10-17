import { SearchConsole, type SearchConsoleProps } from '../SearchConsole';
import { Reveal, Section } from '../Section';

export type EngineChapterProps = SearchConsoleProps & { deepTargets: number[] };

const SERVER_FACTS = [
  ['离线答案表', '1900–2100 每一天的六种写法都预先扫到前 10 亿位，随仓库发布，打开即有结论。'],
  ['4,000,000 字节一块', '按 Range 只取需要的那一段，不整份下载。'],
  ['落到磁盘缓存', '.pi-cache/digits-*.bin，第二次访问不必再上网。'],
  ['命中即停', '所有写法都确认到首个出现位置就提前结束。'],
  ['不假装找到', '拉取失败只记缺口并重试，缺口不会被算成「没有出现」。'],
  ['表与扫描互相印证', '离线答案表先给结论，实时扫描独立再扫一遍；表说没出现、扫描却找到了，就以扫描为准。'],
];

const STATIC_FACTS = [
  ['离线答案表', '1900–2100 每一天的六种写法都预先扫到前 10 亿位，随站点一起发布，打开即有结论。'],
  ['站点自带 100 万位', 'public/pi-1m.txt 跟着站点一起发布，同源读取，实时扫描就在这段上跑。'],
  ['Worker 并行分块', '这段文本被切成块分给多个 Worker，主线程只负责渲染结果。'],
  ['命中即停', '所有写法都确认到首个出现位置就提前结束。'],
  ['不假装找到', '读取失败只记缺口并重试，缺口不会被算成「没有出现」。'],
  ['表与扫描互相印证', '离线答案表先给结论，站点自带的 100 万位副本再独立扫一遍作为验证；表说没出现、扫描却找到了，就以扫描为准。'],
];

/** 工程实现：分块点亮的方块 + 实时扫描数据 + 深搜 CTA。 */
export function EngineChapter({ deepTargets, source, ...consoleProps }: EngineChapterProps) {
  const isServer = source?.kind === 'server';
  return (
    <Section
      id="engine"
      eyebrow="怎么找的"
      title={isServer ? '从上游搬到本地，再一块块扫' : '一块块扫'}
      lead={
        isServer
          ? '页面本身不做计算：本机服务把 MIT 的 π 文件按块搬到磁盘，浏览器把每一块交给 Worker 扫，扫到就停。'
          : '在线演示版用的是已经扫好的离线答案表（前 10 亿位），再加上站点自带的 100 万位副本：位次直接来自表，浏览器把这份副本切成块交给多个 Worker 并行扫一遍作为独立验证。想看现场一路扫到 10 亿位，把仓库 clone 到本机跑 pnpm dev。'
      }
    >
      <Reveal index={0} className="engine-facts">
        <div className="block-track" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="block" style={{ animationDelay: index * 260 + 'ms' }} />
          ))}
        </div>
        <ul className="fact-list">
          {(isServer ? SERVER_FACTS : STATIC_FACTS).map(([title, text]) => (
            <li key={title}>
              <b>{title}</b>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal index={1} step={120} className="engine-console">
        <SearchConsole {...consoleProps} source={source} deepTargets={deepTargets} />
      </Reveal>
    </Section>
  );
}

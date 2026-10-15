import { SearchConsole, type SearchConsoleProps } from '../SearchConsole';
import { Reveal, Section } from '../Section';

export type EngineChapterProps = SearchConsoleProps & { deepTargets: number[] };

const SERVER_FACTS = [
  ['4,000,000 字节一块', '按 Range 只取需要的那一段，不整份下载。'],
  ['落到磁盘缓存', '.pi-cache/digits-*.bin，第二次访问不必再上网。'],
  ['命中即停', '所有写法都确认到首个出现位置就提前结束。'],
  ['不假装找到', '拉取失败只记缺口并重试，缺口不会被算成「没有出现」。'],
];

const STATIC_FACTS = [
  ['站点自带 100 万位', 'public/pi-1m.txt 跟着站点一起发布，同源读取，不需要后端。'],
  ['Worker 并行分块', '这段文本被切成块分给多个 Worker，主线程只负责渲染结果。'],
  ['命中即停', '所有写法都确认到首个出现位置就提前结束。'],
  ['不假装找到', '读取失败只记缺口并重试，缺口不会被算成「没有出现」。'],
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
          : '在线演示版没有后端：站点自带圆周率小数点后前 100 万位，浏览器把它切成块交给多个 Worker 并行扫，扫到就停。想看更深的位置，把仓库 clone 到本机跑 pnpm dev。'
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

import { dateRangeDays } from '../lib/date';
import { formatDepth, formatNumber } from '../lib/format';
import { IconExternal } from './Icons';
import type { Manifest } from '../lib/types';

interface MethodColophonProps {
  manifest: Manifest | null;
  depth: number;
}

export function MethodColophon({ manifest, depth }: MethodColophonProps) {
  return (
    <section id="method" className="section section--method" aria-labelledby="method-title" data-reveal>
      <header className="section__head">
        <p className="eyebrow">05 / 方法</p>
        <h2 id="method-title">
          方法，而不是<em>魔术</em>
        </h2>
        <p className="section__lead">
          页面不实时扫描 π。它读一张已经扫好的答案表，再把判断依据摊开给你看：位次、次数、口径、复核结果，都能追溯。
        </p>
      </header>

      <div className="colophon">
        <div className="colophon__intro">
          <p className="colophon__dropcap">π 是无限的，但这一页只承诺它扫过的范围。</p>
          <p>
            日期的六种写法会得到六串长度不同的数字。页面把每一串数字都当成一个「针」，在 π 的前
            10 亿位里找到它第一次完整落下的位置，并记下它出现了多少次。
          </p>
          <p>
            答案表按年存放在 <code>public/answers/</code>，每天一行，每行六个槽位。首屏只加载当前年份；翻到相邻年份时再取，不把 201 个文件一次性塞进浏览器。
          </p>
          <p>
            位次从 π 的小数点后第 1 位开始数。次数允许重叠：同一个数字串可以在不同起点重复出现。缺失值写成 <code>null</code>，不拿 0 或空字符串冒充答案。
          </p>
        </div>

        <div className="colophon__data">
          <h3 className="eyebrow">这张表</h3>
          <dl className="colophon__stats">
            <div>
              <dt>扫描深度</dt>
              <dd>{formatDepth(depth)}</dd>
            </div>
            <div>
              <dt>覆盖年份</dt>
              <dd>1900 – 2100</dd>
            </div>
            <div>
              <dt>天数</dt>
              <dd>{formatNumber(dateRangeDays())}</dd>
            </div>
            <div>
              <dt>读数</dt>
              <dd>{formatNumber(dateRangeDays() * 6)}</dd>
            </div>
            <div>
              <dt>未出现</dt>
              <dd>{formatNumber(manifest?.missing ?? 6)}</dd>
            </div>
            <div>
              <dt>去重目标</dt>
              <dd>{formatNumber(manifest?.needles ?? 228411)}</dd>
            </div>
          </dl>
          <p className="colophon__stamp">构建时逐格校验 · 201 年答案表 · 本地测试覆盖</p>
        </div>

        <div className="colophon__notes">
          <div className="colophon__note">
            <h3>数字带怎么来</h3>
            <p>
              前 100 万位随站点打包，位次落在这一段时直接切片；更深的位次按需向{' '}
              <a href="https://api.pi.delivery/" target="_blank" rel="noreferrer">
                Pi Delivery API <IconExternal size={13} />
              </a>{' '}
              请求。单次最多 1,000 位，所以页面只取目标前后约 60 位，不假装能一次拉回十亿位。
            </p>
          </div>
          <div className="colophon__note">
            <h3>为什么边界是 10 亿</h3>
            <p>
              这是答案表实际扫过的深度，不是 π 的尽头。十亿位之后的答案，页面没有；缺失的 6 个读数也只代表「在前 10 亿位内没有出现」。把边界说清楚，比给一个更大的数字更诚实。
            </p>
          </div>
          <div className="colophon__note">
            <h3>怎么读这张表</h3>
            <p>
              位次是「第一次完整出现」的位置，次数是「完整落点」的计数；两者都不把跨过 10 亿边界的部分算进来。年份图集用对数分档着色，所以颜色深浅表达的是数量级，不是线性距离。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

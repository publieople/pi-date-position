export interface SelfCheckState {
  status: 'idle' | 'checking' | 'ok' | 'bad';
  got?: string;
  message?: string;
}

export interface ConventionsProps {
  selfCheck: SelfCheckState;
  sourceKind: string;
}

/** 口径 / 数据来源 / 自检，三张卡片。 */
export function Conventions({ selfCheck, sourceKind }: ConventionsProps) {
  return (
    <div className="trust-grid">
      <article className="trust-card">
        <h3>口径</h3>
        <ul>
          <li>
            <b>位次口径</b>：本文所有「第 N 位」都指<b>小数点之后</b>的第 N 位（N 从 1 开始）。若把小数的整数位 3 也算作第 1 位，则全部位次都要 <b>+1</b>。
          </li>
          <li>
            <b>写法去重</b>：MMDD 与 DDMM、YYYYMMDD 与 YYYY-MM-DD 在数字串上可能完全相同，此时只搜索一条数字串，各写法共用同一结论。
          </li>
          <li>
            <b>「已确认」的含义</b>：只有当第 1 位到「命中起点 + 数字串长度 - 1」之间全部被扫描过，该位置才算已确认；否则显示为暂定。
          </li>
        </ul>
      </article>

      <article className="trust-card">
        <h3>数据来源与交叉验证</h3>
        <ul>
          <li>
            <b>数据来源</b>：MIT SIPB 的{' '}
            <a href="https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt" target="_blank" rel="noreferrer">
              pi-billion.txt
            </a>
            （10 亿位小数，1,000,000,002 字节）。{' '}
            {sourceKind === 'server' ? (
              <>
                本机服务按 4,000,000 字节一块做 Range 拉取并缓存到 <code>.pi-cache/</code>，浏览器不直连上游。
              </>
            ) : (
              <>
                在线演示版读的是站点自带的前 1,000,000 位副本（<code>public/pi-1m.txt</code>），要查更深的位置就在本机跑{' '}
                <code>pnpm dev</code>。
              </>
            )}
          </li>
          <li>
            <b>交叉验证</b>：可用{' '}
            <a href="https://api.pi.delivery/v1/pi?start=0&numberOfDigits=100" target="_blank" rel="noreferrer">
              api.pi.delivery
            </a>{' '}
            复核任意位置；仓库里也带了 <code>pnpm crosscheck</code>。
          </li>
          <li>
            <b>为什么不直接问上游</b>：MIT 的文件没有 CORS 头，浏览器不能直连。
            {sourceKind === 'server' ? (
              <> 所以页面上的每一次取数都经过本机服务（<code>/api/digits</code>）。</>
            ) : (
              <> 在线演示版只读站点自带的那一份前 100 万位（同源文件）；要 10 亿位就在本机跑 <code>pnpm dev</code>，由本机服务代取。</>
            )}
          </li>
        </ul>
      </article>

      <article className="trust-card">
        <h3>数据自检</h3>
        <p className="trust-line">每次打开页面都会现场核对「第 762 位起 6 位」：π 在这里有著名的连续六个 9（费曼点）。</p>
        <div className="selfcheck-row">
          {selfCheck.status === 'idle' ? <span className="dim">等待数据源…</span> : null}
          {selfCheck.status === 'checking' ? <span className="dim">检测中…</span> : null}
          {selfCheck.status === 'ok' ? (
            <span className="selfcheck selfcheck-ok">
              通过 · 第 762 位起 = <code>{selfCheck.got}</code>
            </span>
          ) : null}
          {selfCheck.status === 'bad' ? (
            <span className="selfcheck selfcheck-bad">
              异常 · {selfCheck.message ?? selfCheck.got}
            </span>
          ) : null}
        </div>
        <p className="trust-line dim">
          当前数据源：
          {sourceKind === 'server'
            ? '本机 π 服务（10 亿位）'
            : sourceKind === 'static'
              ? '站点内置静态文件（100 万位）'
              : '不可用'}
        </p>
      </article>
    </div>
  );
}

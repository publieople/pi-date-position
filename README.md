# π 里的今天 · 你的日期藏在圆周率的第几位

把任意一天写成 6 种常见数字写法，看看它在 **π 的小数点后第几位**第一次出现。整页滚动的产品展示站：首屏只有一个巨型答案数字，向下滚动逐章展开证据、方法与口径。滚动带吸附 —— 滚轮落在章节边界时一次翻一整段，比一屏高的章节先原生滚到底再翻页。默认跟随系统当天（秒级时钟，跨零点自动重跑），选中的日期会写进地址栏的 `?date=`，链接可以直接分享，浏览器前进 / 后退也在日期之间走。

## 在线演示

**<https://publieople.github.io/pi-date-position/>**（仓库：<https://github.com/publieople/pi-date-position>）

线上版是纯静态站点：没有后端，但带着一份**离线答案表**（`public/answers/`）—— 1900–2100 年每一天的六种写法都预先扫到了**前 10 亿位**，所以首屏直接给出权威位次，不用等浏览器现扫。同一份表也随仓库发布，`pnpm dev` 与本机服务共用它。

页面上的实时扫描仍然照跑，但它的角色是「亲眼再验证一遍」：静态站只有站点自带的**前 100 万位**（`public/pi-1m.txt`），本机模式下由 `pnpm dev` 的服务按 4,000,000 字节一块去取 MIT 的 π 文件并缓存到 `.pi-cache/`，可以一路扫到 10 亿位。

## 快速开始

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5273
```

首次查询会从 MIT 拉取需要的分块（每块 4MB，永久缓存在 .pi-cache/）；之后同一段位次是本地读盘，毫秒级返回。

## 页面结构（整页滚动）

| 章节 | 深链 | 内容 | 入场动效 |
| --- | --- | --- | --- |
| 首屏 | `#hero` | **唯一主元素**：巨型位次数 —— 优先显示「这一天里最早确认命中的写法」（kicker 标出是哪种写法，如 `已确认的位次 · 离线答案表 · MMDD 1015`）；一个都没确认时才显示实时扫描计数 + 日期副标题 + 实时钟 | 数字从下方浮入并去模糊、位次 0 → N 计数 900ms、副标题与提示依次跟进；滚动时整块视差上移淡出 |
| 一个日期，六种写法 | `#forms` | 6 张写法卡片（3×2） | 卡片按 90ms 依次浮入；每张显示自己的位次统计 |
| 它在 π 的哪里 | `#digits` | 命中处前后各 40 位的数字带 + 背景数字流 | 数字带自左滑入，命中片段逐位点亮（每位 30ms） |
| 我们是怎么找到的 | `#engine` | 实时扫描数据 + 深搜 CTA（1 亿 / 10 亿）+ 实现要点 | 6 个方块依次点亮并循环；进度条从 0 滚到实际值 |
| 换一天试试 | `#pick` | 日期选择器 + 所选日期 6 种写法的紧凑结果行（可选范围就是答案表覆盖的 1900-01-01 – 2100-12-31） | 随章节浮入 |
| 口径与来源 | `#trust` | 位次口径 / 数据来源与交叉验证 / 数据自检徽章 | 三张卡片横向错位浮入 |

- 右侧固定导航轨（≥900px 显示）标出当前章节，点击平滑滚动；首屏时不显示。
- 深链：`http://127.0.0.1:5273/#forms` 之类直接定位到章节（挂载时瞬时定位，供截图与分享）。
- 指定日期：`http://127.0.0.1:5273/?date=2028-02-29`（非法值忽略，回落到今天；超出 1900-01-01 – 2100-12-31 的会被夹回边界，\`clampDateKey\` 是纯函数、有单测）；在页面上换日期后地址栏会跟着变（今天不带参数），复制链接即可分享当前这一天，浏览器后退回到上一天。日期框也带同样的 \`min\` / \`max\`，日期选择器下面写明范围。
- 首屏的位次来自**离线答案表**（深度 10 亿位，覆盖 1900–2100 的每一天），打开即有结论；卡片上会写明「已确认（离线答案表）」。表还在路上（或者这一轮取表失败）时，首屏先显示实时扫描进度 —— 表在路上的那几帧不会先报「另一种写法」的暂定位次、再被表的结论整条换掉（`answersDate` 记的是当前这份表属于哪一天，换日期时先清空）。同一时间浏览器还在跑实时扫描（首屏默认目标 **1000 万位**，可在 `#engine` 里选 1 亿 / 10 亿），用来独立验证表里的结论 —— 规则写死在 `src/lib/answers.ts` 的 `mergeSlot`：表里有位次就以表为准（数字带与首屏都跟着表走），只有「表说深度内没出现、实时扫描却找到了」这种情况才以实时扫描为准（表可能旧了）；卡片上那条「上次实时扫描记到」是本地缓存里的旧记录，与表一致时会写明。表里没覆盖到的写法（比如带分隔符的写法）仍走实时扫描，8 位完整写法在实时水位内还没锁定时，卡片会写明「未扫完」。首屏脚注会如实说清这一轮实时扫描能复验到多深 —— 取的是**本轮扫描的目标深度**（默认 1000 万位，静态版为站点自带的 100 万位），而不是数据源的容量，所以本机默认状态下 5 亿位的结论不会写着「下面的实时扫描会自己再验证一遍」；在 `#engine` 里把目标调到 1 亿 / 10 亿后，脚注会跟着改成「会自己再验证一遍」（`src/lib/headline.ts` 的 `tableNote`）。
- **滚动吸附**：`html { scroll-snap-type: y proximity }` 给每章 `scroll-snap-align: start`，再由 `useSectionPaging` 接管滚轮：落在章节边界时一次翻一整段（700ms 锁定窗口防连翻；触控板一次滑动会发几十条 1–3px 的事件，`src/lib/paging.ts` 的 `accumulateWheel` 把「距上一条事件 90ms 内」的 deltaY 一路累加、攒够 12px 才判定，单条 1–3px 的小事件不会被丢掉，也不会因为一次滑动拖得久就把进度清零），比一屏高的章节先原生滚到底再翻页，一屏装得下的章节上下都直接翻页。键盘走同一套章节吸附：`PageDown` / `PageUp` 翻章、`Home` / `End` 到整页两端（带 Ctrl / Shift 的组合、以及焦点在输入框里时不拦），判定在纯函数 `pagingIntentForKey` 里。用 `proximity` 而不是 `mandatory`，避免读长章节时被弹回段首；触屏、拖动滚动条与 `prefers-reduced-motion: reduce` 都不吸附。
- **动效可关**：遵守 `prefers-reduced-motion: reduce` —— 所有入场、计数、点亮、数字流与视差一次性归零，内容直接呈现终态。
- **无障碍**：整页 `lang="zh-CN"`；首屏那个逐帧计数的巨型数字整块 `aria-hidden`（读屏不会被动画中间值刷屏），另有一个 `sr-only` 的 `aria-live="polite"` 区域只说稳定后的结论 —— 「YYYYMMDD 20261015 首次出现在 π 的小数点后第 521,625,248 位」；导航轨给当前章节挂 `aria-current`。整页唯一的 `h1` 是首屏那段 `sr-only` 的「π 里的今天 —— 你的日期藏在圆周率的第几位」，首屏 `<section>` 拿它做 `aria-labelledby`，所以首屏内容也落在一个有名字的地标里；扫描进度条有 `aria-label`（「实时扫描进度：前 N 位」）；`#engine` 的指标网格用 `<dl>` 包住 `<dt>/<dd>`。用 axe-core（wcag2a/2aa/2.1a/2.1aa + best-practice）在桌面与 390px 两种视口下跑过，均无违规。

## 六种写法

`YYYYMMDD`、`MMDD`、`DDMM`、`YYMMDD`、`MMDDYYYY`、`DDMMYYYY`（都保留前导零，例如 2028-02-29 的 MMDD 是 `0229`）。`MMDD` 与 `DDMM` 数字串相同时（如 11-11）合并成一条搜索、结果共用；`YYYY-MM-DD`、`MM-DD` 等带分隔符写法与前两种是同一串数字，另列在「展开带分隔符写法」里。

## 位次口径（重要）

- 「小数点后第 k 位」对应 MIT 文件的第 `k + 1` 个字节：字节 0 是整数位的 `3`，字节 1 是小数点。
- 如果你习惯把整数位 `3` 也算作「第 1 位」，那么本页面给出的位置 **+1** 就是你的编号。
- 页面内置自检：第 762 位起 6 位必须是 `999999`（费曼点），自检不通过会红字提示。

## 数据从哪来

1. **本机服务（首选）**：`/api/meta` + `/api/digits`，由 `server/pi-service.mjs` 提供，dev / preview / `pnpm serve` 三者共用同一份中间件。
   - 上游：<https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt>（10 亿位小数，ASCII 无换行，支持 Range 请求）。
   - 按 4,000,000 字节一块切成 251 块，先写临时文件再 `rename`，所以缓存文件永远是完整的；同一块的并发请求只下载一次。
2. **静态版（GitHub Pages）**：位次读站点自带的**离线答案表**（`public/answers/`，深度 10 亿位，见下一节）；实时扫描与数字带读 `public/pi-1m.txt`（`pnpm fetch-fallback` 生成，前 100 万位）；命中位次超过 100 万位时，数字带改用公开接口 <https://api.pi.delivery> 取回命中点附近的一小段（`src/lib/digitSource.ts` 的 `remoteWindowRange` + `createRemoteWindow`，单次上限 1000 位，页面会注明这一段来自哪里）。没有本机服务时页面走这条路，所以「实时扫描只到前 100 万位」这件事写在 `#engine` 与 `#trust` 两章里（首屏不插提示条），8 位写法在实时水位内找不到时不下结论；答案表取不到（网络或格式问题）时页面顶部会明确提示「这一轮位次只来自实时扫描」，不会悄悄把结论深度降下来（数据源与答案表同时不可用时，提示会写明这一轮连预计算的位次都没有）。
3. 浏览器**不能**直连 MIT：该服务器没有返回 `Access-Control-Allow-Origin`，跨域会被挡，所以必须经本机服务。

## 离线答案表

π 是固定的，而查询空间只是「日期」：1900–2100 年每天六种写法，一共 228,411 个不同的数字串。与其让每个访客现扫十亿位，不如**离线扫一遍、把答案随站点发布**：

```bash
pnpm answers:selftest   # 用自带的前 100 万位对拍「滑窗扫描 vs 朴素 indexOf」，约 4600 项
pnpm answers            # 全量重扫：1900–2100，深度 10 亿位（本机实测约 16 分钟，瓶颈在上游带宽，会复用 .pi-cache）
pnpm answers -- --resume        # 断了以后从 .pi-cache/answers-state.json 的检查点续扫
pnpm answers -- --depth 2000000000   # 想更深也可以（文件体积随之变大）
```

- 产物：`public/answers/manifest.json` + 每年一个 `<年份>.json`（201 个文件，合计约 6.0 MB；年份文件按需单取，单个约 31 KB、gzip 后约 12 KB）。
- 每格是 `[位次, 次数]`：位次是「小数点后第 k 位」（1-based），次数是**完整落在前 10 亿位内**的出现次数（允许重叠）；深度内没出现过就是 `null`。位次与次数同源同深度，所以卡片上的两行不会自相矛盾。
- 覆盖范围：`fromYear 1900` – `toYear 2100`；228,411 个数字串里有 6 个在 10 亿位内从未出现（年份文件里记 `null`，页面照实说「10 亿位内未出现」）。
- 页面侧只认 `version: 1` + `fields: ['position', 'count']` 的表：旧的、格式不符的表会被 `src/lib/answers.ts` 的 `parseManifest` 拒掉，页面自动退回纯实时扫描（不会拿错数据）。
- 合并规则：表里有的写法以表为准（`origin: 'table'`，同时带上 `knownThrough`），实时扫描继续在后台跑；表说「没出现」而实时扫描找到了，以实时扫描为准。进度类字段（已扫描位数、缺口、耗时）始终只描述实时扫描。

## HTTP 接口

| 请求 | 说明 |
| --- | --- |
| `GET /api/meta` | 数据源信息：`totalDigits`、`blockSize`、`blockCount`、`cachedBlocks`、`cachedBytes`、已取回字节、服务过的位数、上游错误数 |
| `GET /api/digits?from=1&count=10` | 从第 1 位起 10 位 → `text/plain` 的 `3141592653`… 精确说是 `1415926535`；`from` ≥ 1，`count` ≤ 4,000,016（块大小 4,000,000 + 供跨块重叠用的 16 位余量）；响应头带 `x-pi-from` / `x-pi-count` |

错误：`400 bad_request`（参数非法）、`404 unknown_api`、`405 method_not_allowed`、`502 upstream_unavailable`（带 `from` / `count`，前端会显示为缺口而不是「未找到」）。

## 搜索算法：为什么它的结论可信

- **阶梯分块**：64K → 512K → 1M → 4M，从第 1 位开始顺序申请，最多 4 块在途；越往深处块越大，减少请求数。
- **跨块重叠**：每块实际取回「本块区间 + 最长串长 − 1 位」，所以跨越块边界的数字串一定能被某一整块完整看到，且每个出现只归属一块（不重复计数、不漏）。
- **覆盖水位**：只有「从第 1 位起连续扫描到的位置」越过某个命中的起点 + 串长时，那个命中才标为**已确认**；否则只标**暂定**（UI 会写明）。这个水位是**每个写法按自己的串长各算一份**的：4 位写法不会被 8 位完整写法拖累（页面顶部的「已验证到 N 位」仍取最保守的全局水位，按最长串算）。
- **缺口**：中间块失败只记录缺口并重试，页面显示「未扫完（有缺口或已停止）」，**绝不**根据缺口说「没出现」。只有真正扫完目标范围（或数据源尽头）且没有缺口，才会给出「未在前 N 位出现」。
- **提前停止**：所有写法的首个命中都确认后立即停止，不会白扫剩下的位。

## 动效实现（不引入任何动画库）

- `src/lib/motion.ts`：`clamp01` / `easeOutCubic` / `stagger` / `revealDelay` / `countUpValue` / `scrollThroughProgress` 等纯函数（有单测）。
- `src/lib/present.ts`：首屏展示哪一条写法的选择逻辑（`pickDisplayNeedle`）—— 主写法确认了就用它，否则取「已确认写法里位次最靠前的」，最后才退到暂定位次；纯函数、有单测（以前埋在 `App.tsx` 里没有测试）。
- `src/hooks/`：`useInView`（IntersectionObserver，once + cleanup，StrictMode 安全）、`useScrollProgress`（rAF 节流的 passive 滚动监听，只读 `getBoundingClientRect`）、`useCountUp`、`usePrefersReducedMotion`、`useActiveSection`、`useSectionPaging`（滚轮 + 键盘翻章）、`useDateSelection`（日期状态 + `?date=` 深链 + 地址栏同步 + 夹回 1900–2100）、`useInitialHash`（挂载时滚到 `#hash` 章节）、`usePiSource` / `useScanPool`（探测数据源、建 Worker 池）、`useAnswersForDate`（这一天的表：`table` / `waiting` / `missing`）、`useSearchSession`（启动扫描 + 本地缓存）、`useDigitsStrip`（数字带，远位走 api.pi.delivery）、`useSelfCheck`（第 762 位起 6 位）。翻页判定在 `src/lib/paging.ts` 的 `pageTarget` / `sectionIndexAt` / `accumulateWheel` / `pagingIntentForKey` 里，是纯函数、有单测；hook 只负责度量章节、拦滚轮与页面键、维持 700ms 锁定窗口。地址栏与日期同步用 `src/lib/position.ts` 的 `withDateParam`（纯函数、有单测）。
- `src/App.tsx`：自身只做**组合** —— 日期、数据源、答案表、扫描会话、数字带、自检各一个 hook，页面视图由 `src/lib/answers.ts` 的纯函数 `composeView`（有单测）把「实时扫描快照 + 这一天的答案表」合成，降级提示抽在 `src/components/DataSourceNotice.tsx`。
- CSS：JS 挂载后给 `<html>` 加 `.js-motion`，之后 `.reveal` 才有 `opacity: 0` / `translateY(20px)` 初值，进入视口加 `.is-in` 过渡到终态（0.7s）。**没有 JS 时内容默认可见**。只动 `transform` / `opacity` / `scale`。

## 脚本

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | Vite 开发服务器 + π 中间件（5273） |
| `pnpm build` | 构建到 dist/（base `/`，配合 `pnpm serve` / `pnpm preview`） |
| `pnpm build:pages` | 构建到 dist/，带子路径 base `/pi-date-position/`（GitHub Pages 项目站用） |
| `pnpm serve` | 用 dist/ + 同一 API 起生产服务（默认 5274，`--port` 可改） |
| `pnpm test` | vitest（算法 / 中间件 / 真数据锚点 / 动效纯函数） |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm fetch-fallback` | 生成 `public/pi-1m.txt` |
| `pnpm answers` | **离线答案表**：扫 1900–2100 每一天的六种写法（默认深度 10 亿位），写出 `public/answers/`；`--resume` 续扫、`--depth` / `--concurrency` 可调 |
| `pnpm answers:selftest` | 用自带的前 100 万位对拍生成器的扫描/计数逻辑（滑窗 vs 朴素 indexOf） |
| `pnpm crosscheck -- --date 2026-10-14` | **独立复核**：不导入应用代码，自己按 MIT 文件重新找一遍，再用 <https://api.pi.delivery> 逐个验证位置（`--limit` 默认 1000 万位） |
| `pnpm prewarm -- --date 2026-10-14 --depth 1000000000` | **深搜 + 预热缓存**：走本机服务的 `/api/digits` 顺序扫描（顺带把 `.pi-cache` 写满），打印六种写法的首次出现位置并用 <https://api.pi.delivery> 复核；`--concurrency`（默认 4）、`--base` 可调。预热过之后页面上同样的深搜只需几秒 |

## 验收清单

```bash
pnpm dev   # 另开一个终端
curl "http://127.0.0.1:5273/api/digits?from=1&count=10"         # 1415926535
curl "http://127.0.0.1:5273/api/digits?from=762&count=6"        # 999999
curl "http://127.0.0.1:5273/api/digits?from=999999998&count=3"  # 519（数据源到小数点后第 10 亿位为止；count 超出末尾会自动截断）
pnpm test        # 109 个用例
pnpm typecheck
pnpm build
pnpm build:pages # 子路径构建（GitHub Pages 部署用的就是它）
pnpm crosscheck -- --date 2026-10-14
pnpm prewarm -- --date 2026-10-14 --depth 1000000000
pnpm answers:selftest
```

页面侧（`screenshots/` 里的同名文件就是本机实拍）：

```bash
pnpm dlx playwright screenshot --channel=chrome --color-scheme=dark --viewport-size "1440,900" --wait-for-timeout 4500 http://127.0.0.1:5273/ screenshots/showcase-hero.png
# 章节： #forms / #digits / #engine / #pick / #trust 各来一张
pnpm dlx playwright screenshot --channel=chrome --color-scheme=dark --viewport-size "1200,630" --wait-for-timeout 4500 http://127.0.0.1:5273/ public/og-cover.png
```

手工核对：首屏计数从 0 走到位次、卡片 90ms 依次浮入、数字带命中片段逐位点亮、`#engine` 方块循环点亮、导航轨高亮与点击跳转、滚轮翻章（在章节边界滚一格翻一整段，`#forms` 这种比一屏高的段先原生滚到底）、`PageDown` / `PageUp` / `Home` / `End` 走同一套吸附、换一天后地址栏出现 `?date=` 且浏览器后退能回到上一天、`?date=2028-02-29`（首屏给 `DDMM 2902` → 第 713 位；`YYMMDD 280229` → 第 451,478 位）、日期切换后首屏跟随、停止 / 重新搜索 / 清空本机记录、静态数据源下 `#engine` / `#trust` 的文案分支、762 位自检徽章、静态站上 `#digits` 的远位数字带（`?date=2026-10-15` → 第 521,625,248 位，数字带应显示 88 位并注明取自 api.pi.delivery）；再把浏览器调成 620px 宽确认单列与导航轨隐藏，并在 DevTools 里模拟 `prefers-reduced-motion: reduce` 确认所有动画一次性归零。

## 界面实拍

| 首屏 | 六种写法 | 扫描实现 |
| --- | --- | --- |
| ![首屏](screenshots/showcase-hero.png) | ![六种写法](screenshots/showcase-forms.png) | ![扫描实现](screenshots/showcase-engine.png) |

（`screenshots/` 里的图片都是本机 Chrome 实拍，命令见上面的验收清单。）

## 发布到 GitHub Pages

线上地址 <https://publieople.github.io/pi-date-position/>，部署由 `.github/workflows/pages.yml` 负责：push 到 `main`（或手动 `workflow_dispatch`）时用 pnpm（版本由 `package.json` 的 `packageManager` 固定为 `pnpm@12.11.2`）+ Node 24 跑 `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test` → `pnpm build:pages`，再把 `dist/` 交给 `actions/deploy-pages`。

- **子路径**：项目站的地址形如 `/<repo>/`，所以部署构建必须带 base —— `pnpm build:pages` 就是 `vite build --base=/pi-date-position/`。本地 `pnpm build`（base `/`）配合 `pnpm serve` / `pnpm preview` 的行为不变。
- **同源请求都带 base**：`src/lib/digitSource.ts` 里的 `BASE` 取自 `import.meta.env.BASE_URL`；线上探测 `/api/meta` 失败（GitHub Pages 会给 404 页面）后自动回退到 `/pi-date-position/pi-1m.txt`。
- **Pages 设置**：Source = **GitHub Actions**（API 里的 `build_type: workflow`）。
- **改名要同步三处**：`package.json` 的 `build:pages --base`、`README`/页面里的地址，以及 `index.html` 里 `og:url` / `og:image` 的绝对地址（分享封面 `public/og-cover.png` 随站点一起发布，1200×630，用本页截图重生成即可）。
- **手工重跑**：`gh workflow run pages.yml`；想在本机预览线上的子路径效果，`pnpm build:pages` 后把 `dist/` 放到名为 `pi-date-position/` 的目录里，再从上一层目录起静态服务。

## 磁盘

`.pi-cache/` 每块 4MB，最坏 251 块 ≈ 1GB；删除即可，下次访问会重新下载（`pnpm prewarm` 深搜一次也会把这个目录写满，属于正常现象）。重跑 `pnpm answers` 时也会尽量复用 `.pi-cache` 里已有的块（日志里会报「N 块来自本机」），并往 `.pi-cache/answers-state.json` 写检查点。`public/answers/` 约 6.0 MB 会随站点一起发布（这也是首屏秒出十亿位答案的代价）。本地结果缓存（localStorage，键前缀 `pi-date-position:v1:`）也可以在页面上点「清空本机记录」清掉。

## 已知边界

- 位次来自离线表（深度 10 亿位）；**数字带**在静态站上用两条来源拼出来：前 100 万位读站点自带的 `public/pi-1m.txt`，更靠后的命中就向 <https://api.pi.delivery> 取命中点前后各 40 位（单次 1000 位上限），数字带下方会写明这一段来自哪里。只有当这个公开接口也取不到时（离线、被墙、上游 5xx），数字带才会退回「附近的数字取不回来」。
- 实时扫描的上限仍是数据源：静态站 100 万位，本机最多 10 亿位。首屏的实时扫描目标默认 1000 万位（可在 `#engine` 里选 1 亿 / 10 亿）；静态站上实时扫描只覆盖前 100 万位，结论以离线表为准。
- 8 位写法在 10 亿位内的出现概率约 99.995%，偶尔真的不出现，页面会明确写「未在前 10 亿位出现」（而不是含糊地说「没找到」）。
- 深搜到 10 亿位要拉约 1GB 数据，视网络需要几分钟；进度、耗时、字节数都在控制台里，随时可以停。
- 上游 MIT 不可达时（例如需要代理），用 `NODE_USE_ENV_PROXY=1 pnpm dev`（Node ≥ 24 会读取 `HTTP(S)_PROXY`）。
- 可选日期只覆盖 **1900-01-01 – 2100-12-31**（离线答案表的范围）：地址栏、日期框、前后一天、随机一天都限制在这个区间，越界的旧链接会被夹回边界，而不是让页面在这张表之外悄悄降级成「只扫到前 100 万位」。

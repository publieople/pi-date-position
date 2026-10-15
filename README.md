# π 里的今天 · 你的日期藏在圆周率的第几位

把任意一天写成 6 种常见数字写法，看看它在 **π 的小数点后第几位**第一次出现。整页滚动的产品展示站：首屏只有一个巨型答案数字，向下滚动逐章展开证据、方法与口径。默认跟随系统当天（秒级时钟，跨零点自动重跑）。

## 在线演示

**<https://publieople.github.io/pi-date-position/>**（仓库：<https://github.com/publieople/pi-date-position>）

线上版是纯静态站点：没有后端，只带站点自带的圆周率**前 100 万位**（`public/pi-1m.txt`），所以线上的搜索上限就是 100 万位。要查小数点后 10 亿位，把仓库 clone 到本机，`pnpm install` 后运行 `pnpm dev` —— 本机服务会按 4,000,000 字节一块去取 MIT 的 π 文件并缓存到 `.pi-cache/`。

## 快速开始

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5273
```

首次查询会从 MIT 拉取需要的分块（每块 4MB，永久缓存在 .pi-cache/）；之后同一段位次是本地读盘，毫秒级返回。

## 页面结构（整页滚动）

| 章节 | 深链 | 内容 | 入场动效 |
| --- | --- | --- | --- |
| 首屏 | `#hero` | **唯一主元素**：巨型位次数 —— 优先显示「这一天里最早确认命中的写法」（kicker 标出是哪种写法，如 `已确认的位次 · MMDD 1015`）；一个都没确认时才显示实时扫描计数 + 日期副标题 + 实时钟 | 数字从下方浮入并去模糊、位次 0 → N 计数 900ms、副标题与提示依次跟进；滚动时整块视差上移淡出 |
| 一个日期，六种写法 | `#forms` | 6 张写法卡片（3×2） | 卡片按 90ms 依次浮入；每张显示自己的位次统计 |
| 它在 π 的哪里 | `#digits` | 命中处前后各 40 位的数字带 + 背景数字流 | 数字带自左滑入，命中片段逐位点亮（每位 30ms） |
| 我们是怎么找到的 | `#engine` | 实时扫描数据 + 深搜 CTA（1 亿 / 10 亿）+ 实现要点 | 6 个方块依次点亮并循环；进度条从 0 滚到实际值 |
| 换一天试试 | `#pick` | 日期选择器 + 所选日期 6 种写法的紧凑结果行 | 随章节浮入 |
| 口径与来源 | `#trust` | 位次口径 / 数据来源与交叉验证 / 数据自检徽章 | 三张卡片横向错位浮入 |

- 右侧固定导航轨（≥900px 显示）标出当前章节，点击平滑滚动；首屏时不显示。
- 深链：`http://127.0.0.1:5273/#forms` 之类直接定位到章节（挂载时瞬时定位，供截图与分享）。
- 指定日期：`http://127.0.0.1:5273/?date=2028-02-29`（非法值忽略，回落到今天）。
- 首屏默认只搜到 **1000 万位**。这个深度通常已经能锁定 `MMDD` / `DDMM` / `YYMMDD`，所以首屏给出的是这一天里最早确认的位次（例如今天 `MMDD 1015` → 第 2,563 位）；8 位完整写法若还没出现，首屏会写明「`YYYYMMDD` 这个 8 位完整写法还没锁定」并指向 `#engine` 的 1 亿 / 10 亿深搜。
- **动效可关**：遵守 `prefers-reduced-motion: reduce` —— 所有入场、计数、点亮、数字流与视差一次性归零，内容直接呈现终态。

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
2. **静态降级**：`public/pi-1m.txt`（`pnpm fetch-fallback` 生成，前 100 万位）。没有本机服务时（例如 GitHub Pages 上的在线演示版）页面读这份同源文件并提示「只有前 100 万位」，8 位写法在此范围内找不到时不能下结论。
3. 浏览器**不能**直连 MIT：该服务器没有返回 `Access-Control-Allow-Origin`，跨域会被挡，所以必须经本机服务。

## HTTP 接口

| 请求 | 说明 |
| --- | --- |
| `GET /api/meta` | 数据源信息：`totalDigits`、`blockSize`、`blockCount`、`cachedBlocks`、`cachedBytes`、已取回字节、服务过的位数、上游错误数 |
| `GET /api/digits?from=1&count=10` | 从第 1 位起 10 位 → `text/plain` 的 `3141592653`… 精确说是 `1415926535`；`from` ≥ 1，`count` ≤ 4,000,016（块大小 4,000,000 + 供跨块重叠用的 16 位余量）；响应头带 `x-pi-from` / `x-pi-count` |

错误：`400 bad_request`（参数非法）、`404 unknown_api`、`405 method_not_allowed`、`502 upstream_unavailable`（带 `from` / `count`，前端会显示为缺口而不是「未找到」）。

## 搜索算法：为什么它的结论可信

- **阶梯分块**：64K → 512K → 1M → 4M，从第 1 位开始顺序申请，最多 4 块在途；越往深处块越大，减少请求数。
- **跨块重叠**：每块实际取回「本块区间 + 最长串长 − 1 位」，所以跨越块边界的数字串一定能被某一整块完整看到，且每个出现只归属一块（不重复计数、不漏）。
- **覆盖水位**：只有「从第 1 位起连续扫描到的位置」越过某个命中的起点 + 串长时，那个命中才标为**已确认**；否则只标**暂定**（UI 会写明）。
- **缺口**：中间块失败只记录缺口并重试，页面显示「未扫完（有缺口或已停止）」，**绝不**根据缺口说「没出现」。只有真正扫完目标范围（或数据源尽头）且没有缺口，才会给出「未在前 N 位出现」。
- **提前停止**：所有写法的首个命中都确认后立即停止，不会白扫剩下的位。

## 动效实现（不引入任何动画库）

- `src/lib/motion.ts`：`clamp01` / `easeOutCubic` / `stagger` / `revealDelay` / `countUpValue` / `scrollThroughProgress` 等纯函数（有单测）。
- `src/hooks/`：`useInView`（IntersectionObserver，once + cleanup，StrictMode 安全）、`useScrollProgress`（rAF 节流的 passive 滚动监听，只读 `getBoundingClientRect`）、`useCountUp`、`usePrefersReducedMotion`、`useActiveSection`。
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
| `pnpm crosscheck -- --date 2026-10-14` | **独立复核**：不导入应用代码，自己按 MIT 文件重新找一遍，再用 <https://api.pi.delivery> 逐个验证位置（`--limit` 默认 1000 万位） |
| `pnpm prewarm -- --date 2026-10-14 --depth 1000000000` | **深搜 + 预热缓存**：走本机服务的 `/api/digits` 顺序扫描（顺带把 `.pi-cache` 写满），打印六种写法的首次出现位置并用 <https://api.pi.delivery> 复核；`--concurrency`（默认 4）、`--base` 可调。预热过之后页面上同样的深搜只需几秒 |

## 验收清单

```bash
pnpm dev   # 另开一个终端
curl "http://127.0.0.1:5273/api/digits?from=1&count=10"         # 1415926535
curl "http://127.0.0.1:5273/api/digits?from=762&count=6"        # 999999
curl "http://127.0.0.1:5273/api/digits?from=999999998&count=3"  # 519（数据源到小数点后第 10 亿位为止；count 超出末尾会自动截断）
pnpm test        # 66 个用例
pnpm typecheck
pnpm build
pnpm build:pages # 子路径构建（GitHub Pages 部署用的就是它）
pnpm crosscheck -- --date 2026-10-14
pnpm prewarm -- --date 2026-10-14 --depth 1000000000
```

页面侧（`screenshots/` 里的同名文件就是本机实拍）：

```bash
pnpm dlx playwright screenshot --channel=chrome --color-scheme=dark --viewport-size "1440,900" --wait-for-timeout 4500 http://127.0.0.1:5273/ screenshots/showcase-hero.png
# 章节： #forms / #digits / #engine / #pick / #trust 各来一张
```

手工核对：首屏计数从 0 走到位次、卡片 90ms 依次浮入、数字带命中片段逐位点亮、`#engine` 方块循环点亮、导航轨高亮与点击跳转、`?date=2028-02-29`（首屏给 `DDMM 2902` → 第 713 位；`YYMMDD 280229` → 第 451,478 位）、日期切换后首屏跟随、停止 / 重新搜索 / 清空本机记录、静态降级提示、762 位自检徽章；再把浏览器调成 620px 宽确认单列与导航轨隐藏，并在 DevTools 里模拟 `prefers-reduced-motion: reduce` 确认所有动画一次性归零。

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
- **改名要同步两处**：`package.json` 的 `build:pages --base` 与 `README`/页面里的地址。
- **手工重跑**：`gh workflow run pages.yml`；想在本机预览线上的子路径效果，`pnpm build:pages` 后把 `dist/` 放到名为 `pi-date-position/` 的目录里，再从上一层目录起静态服务。

## 磁盘

`.pi-cache/` 每块 4MB，最坏 251 块 ≈ 1GB；删除即可，下次访问会重新下载（`pnpm prewarm` 深搜一次也会把这个目录写满，属于正常现象）。本地结果缓存（localStorage，键前缀 `pi-date-position:v1:`）也可以在页面上点「清空本机记录」清掉。

## 已知边界

- 首屏默认 1000 万位：`MMDDYYYY`（今天这一档约第 8740 万位）与 `DDMMYYYY` 必然超出范围，卡片会显示「已扫描范围内没有出现」，这是有意的取舍 —— 首屏仍会给出这一天里最早确认的写法位次，想看 8 位完整写法的位次就点 `#engine` 里的 1 亿 / 10 亿深搜。
- 8 位写法在 10 亿位内的出现概率约 99.995%，偶尔真的不出现，页面会明确写「未在前 10 亿位出现」（而不是含糊地说「没找到」）。
- 深搜到 10 亿位要拉约 1GB 数据，视网络需要几分钟；进度、耗时、字节数都在控制台里，随时可以停。
- 上游 MIT 不可达时（例如需要代理），用 `NODE_USE_ENV_PROXY=1 pnpm dev`（Node ≥ 24 会读取 `HTTP(S)_PROXY`）。

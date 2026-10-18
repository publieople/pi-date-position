# π 日签 · The Pi Almanac

一个纯静态的「日期 × 圆周率」日签：把一天写成六串数字，看看它第一次出现在 π 的小数点后第几位。

**不是实时扫描。** 页面读取随站点发布的离线答案表，把位次、次数、口径和复核入口一起摊开；首屏只加载当前年份，翻到相邻年份时再取。

- 日期范围：1900-01-01 — 2100-12-31
- 扫描深度：小数点后 1,000,000,000 位
- 六种写法：YYYYMMDD / MMDD / DDMM / YYMMDD / MMDDYYYY / DDMMYYYY
- 前端：React 19 + Vite + TypeScript，无后端、无运行时数据库
- 视觉：纸本、墨水、朱砂；Fraunces + IBM Plex Mono + 系统中文字体

## 快速开始

要求 Node.js ≥ 22、pnpm 12。

```bash
pnpm install
pnpm dev        # http://127.0.0.1:5273/
pnpm typecheck
pnpm test
pnpm build      # 输出到 dist/
pnpm preview    # http://127.0.0.1:5274/
```

`pnpm build` 会把 `public/` 原样复制到 `dist/`，包括答案表、`pi-1m.txt`、favicon 和 OG 封面。`vite.config.ts` 中 `base: './'`，构建产物可以直接放到 GitHub Pages 的子路径，不需要改资源前缀。

## 页面结构

| 区块 | 内容 |
| --- | --- |
| 首屏 `#today` | 当天六种写法的巨型位次、目标数字、切换日期与分享入口 |
| `#encodings` | 六张写法卡片：数字、位次、出现次数、对数比例条 |
| `#digits` | 目标数字前后各约 30 位 π 的数字带，朱砂标出目标串；可独立复核 |
| `#scale` | 对数深度尺，把六个位次放在同一张图上；标注占 10 亿的比例与差值 |
| `#atlas` | 年份热力图（12 月 × 31 日），懒加载、键盘可操作；点一格跳到首屏 |
| `#method` | 数据口径、扫描深度、缺失值说明、外链与复核方式 |

## 数据

`public/answers/` 包含 201 个年份文件（1900–2100）和一份 `manifest.json`，合计约 6.25 MB：

```text
public/answers/
  manifest.json
  1900.json … 2100.json
public/pi-1m.txt          # π 的前 1,000,000 位（CRLF，读取时去掉换行）
```

每个年份文件：

```json
{
  "year": 2026,
  "depth": 1000000000,
  "slots": ["yyyymmdd", "mmdd", "ddmm", "yymmdd", "mmddyyyy", "ddmmyyyy"],
  "labels": ["YYYYMMDD", "MMDD", "DDMM", "YYMMDD", "MMDDYYYY", "DDMMYYYY"],
  "days": [[[131535897, 6], [1223, 100360], [12097, 100320], [160957, 1023], [48026541, 8], [15540281, 11]], "…"]
}
```

- `days[0]` 是 1 月 1 日，按日序排列。
- 每格是 `[position, count]` 或 `null`。
- `position`：完整数字第一次完整落下的位置，从 π 的小数点后第 1 位开始计数。
- `count`：完整落点在前 10 亿位内出现的次数，允许重叠。
- `null`：在这个深度内没有出现；**不拿 0 或空字符串冒充答案**。
- 位次和次数都只在这个扫描深度内成立，不代表 π 的尽头。

`manifest.json` 记录深度、年份范围、六种写法、缺失读数和数据来源；当前记录：

- `needles`: 228,411
- `missing`: 6
- 覆盖天数：73,414（201 年，含闰日；由年份表累计）
- 数据源：`https://stuff.mit.edu/afs/sipb/contrib/pi/pi-billion.txt`
- 生成时间：2026-10-15

更深的数字带通过 [Pi Delivery API](https://api.pi.delivery/) 实时取：

```text
GET https://api.pi.delivery/v1/pi?start=<1-based start>&numberOfDigits=<1..1000>
```

页面每次只取目标前后约 60 位，并在数字带下方提供「独立复核」：第二次请求与展示请求互相独立，避免把同一个缓存当成两次证据。API 不可用时，数字带降级为提示，不影响位次阅读。

## 交互与 URL

- `←` / `→`：前一天 / 后一天
- `↓`：跳到六种写法
- `T`：回到今天（取消固定日期）
- `S`：打开分享
- `/`：聚焦日期输入
- `Esc`：关闭分享弹窗
- 日期输入、图集格子等控件内不会触发全局快捷键

URL 参数：

```text
?date=2026-10-18&slot=yyyyMMdd
```

`slot` 可选 `yyyyMMdd`、`mmDd`、`ddMm`、`yyMMdd`、`mmDdYyyy`、`ddMmYyyy`。只带 `date` 时使用默认写法；参数会通过 `history.replaceState` 同步，便于分享某一天。分享弹窗可以复制链接、复制摘要、调用系统分享，或生成 1080 × 1350 的 PNG 海报（跟随当前主题）。

## 设计说明

- 浅色为纸本，深色为墨色；颜色、对比度与主题切换都由 CSS 变量控制。
- 数字用 Fraunces Variable，元信息用 IBM Plex Mono，中文回落到系统宋体/黑体栈。
- 首屏巨型位次、六种写法细目、数字带、对数尺、年份热力图、方法页，都围绕「可追溯」而不是「看起来很厉害」。
- 减少动态偏好（`prefers-reduced-motion`）下关闭滚动与入场动画。
- 键盘可达；桌面浅色/深色与移动浅色均通过 axe-core 的 WCAG A/AA 检查（violations = 0）。
- 分享海报和 OG 封面都是本地生成/静态资源，不依赖第三方截图服务。

## 已验证的数据

以下值用于回归检查，均可由 `public/answers/` 和 `public/pi-1m.txt` / API 复核。

**2026-10-18**

| 写法 | 数字 | 位次 | 前 10 亿位内次数 |
| --- | --- | ---: | ---: |
| YYYYMMDD | 20261018 | 131,535,897 | 6 |
| MMDD | 1018 | 1,223 | 100,360 |
| DDMM | 1810 | 12,097 | 100,320 |
| YYMMDD | 261018 | 160,957 | 1,023 |
| MMDDYYYY | 10182026 | 48,026,541 | 8 |
| DDMMYYYY | 18102026 | 15,540,281 | 11 |

**2028-02-29（闰日）**：476,618,908 / 6,706 / 713 / 451,478 / 49,701,240 / 101,597,445（六种写法按上表顺序）。

**深度内未出现的 6 个读数**：

```text
1920-11-30  YYYYMMDD
1947-09-18  DDMMYYYY
1959-07-05  YYYYMMDD
1971-06-28  DDMMYYYY
2022-10-13  MMDDYYYY
2064-10-26  DDMMYYYY
```

最大位次：997,167,061（2075-12-16，YYYYMMDD）。

## 目录

```text
src/
  App.tsx                 # 状态、键盘、URL 同步、分享
  components/             # Hero / 六种写法 / 数字带 / 深度尺 / 年图集 / 方法 / 分享
  lib/                    # 答案表、π 数字、日期、格式化、海报、主题
  styles/                 # tokens / base / app
  test/                   # date / digits / format / answers
public/
  answers/                # 201 个年份文件 + manifest
  pi-1m.txt               # 前 100 万位 π
  favicon.svg
  og-cover.png            # 1200 × 630
```

## 限制

- 离线答案表只承诺前 10 亿位；更深的位次需要扩展答案表或实时检索。
- 数字带依赖 Pi Delivery API；无网络时仍可看位次，但不能复核数字。
- 年图集按年份懒加载，首次切换年份会有一次网络请求。
- 「第一次出现」按完整数字的完整落点计算；次数允许重叠，两者都不跨过 10 亿位边界。
- 截图为开发期验证产物，已通过 `.gitignore` 排除，不随仓库发布。

## 许可与来源

代码仅作个人项目示例，未附许可证。字体由 `@fontsource` 分发（SIL Open Font License）；π 数据来源见 `public/answers/manifest.json`；页面中的 API 请求只用于数字带复核。

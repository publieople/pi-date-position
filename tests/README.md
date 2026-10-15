# 测试

- `lib.test.ts`：位次换算、日期解析、日期写法（含闰日与前导零、MMDD==DDMM 合并）、findOccurrencesInText、CoverageTracker、分块规划。
- `searchEngine.test.ts`：跨块重叠命中、乱序到达时的「暂定 → 已确认」、中间块失败只记缺口不判未找到、中途停止、全命中提前停止、扫描器异常回退主线程。
- `piService.test.ts`：分块对齐、并发去重、缓存命中不走上游、长度校验重试、上游全失败 502、/api 各状态码。
- `anchors.test.ts`：真数据锚点（需要先跑 pnpm fetch-fallback 生成 public/pi-1m.txt，否则自动跳过）。
- `motion.test.ts`：动效纯函数（clamp01 / easeOutCubic / stagger / revealDelay / countUpValue / scrollThroughProgress）。
- `paging.test.ts`：滚轮翻章的纯函数判定（pageTarget / sectionIndexAt）。
- `present.test.ts`：首屏写法选择（pickDisplayNeedle）—— 主写法已确认优先、否则取已确认里位次最靠前的、都没确认时退回暂定与顺序回退、全没命中返回 null、标签回退与 origin / knownThrough 透传。
- `answers.test.ts`：离线答案表 —— 日期算术、manifest 与年份文件校验（版本 / 槽位 / 天数 / 格子格式 / 旧格式拒收）、按日期取表、合并进扫描快照、注入 fetch 的取数与缓存失效，以及与 `public/answers/` 产物对齐（表还没重新生成时跳过）。

```bash
pnpm test
```

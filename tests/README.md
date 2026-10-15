# 测试

- `lib.test.ts`：位次换算、日期解析、日期写法（含闰日与前导零、MMDD==DDMM 合并）、findOccurrencesInText、CoverageTracker、分块规划。
- `searchEngine.test.ts`：跨块重叠命中、乱序到达时的「暂定 → 已确认」、中间块失败只记缺口不判未找到、中途停止、全命中提前停止、扫描器异常回退主线程。
- `piService.test.ts`：分块对齐、并发去重、缓存命中不走上游、长度校验重试、上游全失败 502、/api 各状态码。
- `anchors.test.ts`：真数据锚点（需要先跑 pnpm fetch-fallback 生成 public/pi-1m.txt，否则自动跳过）。

```bash
pnpm test
```

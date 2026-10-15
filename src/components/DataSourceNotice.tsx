import type { SourceKind } from '../lib/digitSource';

export interface DataSourceNoticeProps {
  /** 数据源类型；还没探测出来时给 'unknown' */
  sourceKind: SourceKind | 'unknown';
  /** 已经属于这一天、却没取到离线答案表（这一轮取表失败） */
  answersMissing: boolean;
}

/**
 * 页面顶部的降级提示：数据源不可用、或答案表这一轮取不到时如实说一声，
 * 免得页面悄悄变成「只扫到前 100 万位」的样子而不给理由。
 */
export function DataSourceNotice({ sourceKind, answersMissing }: DataSourceNoticeProps) {
  if (sourceKind === 'unavailable') {
    return (
      <p className="notice notice-bad">
        没有可用的 π 数据源：本机服务未启动，且站点自带的 <code>public/pi-1m.txt</code> 读取失败（可执行{' '}
        <code>pnpm fetch-fallback</code> 重新生成）。
        {answersMissing
          ? '离线答案表也没取到，这一轮连预计算的位次都没有。'
          : '位次结论仍来自离线答案表，但实时扫描与数字带暂时不可用。'}
      </p>
    );
  }
  if (!answersMissing) return null;
  return (
    <p className="notice">
      离线答案表没取到（网络或格式问题），这一轮位次只来自实时扫描
      {sourceKind === 'server'
        ? ' —— 本机服务能一路扫到 10 亿位，可以在「怎么找的」里把目标调大；刷新一次也会重新取表。'
        : ' —— 在线演示版只有站点自带的前 100 万位，更深的写法这一轮给不出结论；刷新一次会重新取表。'}
    </p>
  );
}

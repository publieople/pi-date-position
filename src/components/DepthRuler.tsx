import { formatThousands, withUnit } from '../lib/position';
import { depthTicks, logDepthPercent } from '../lib/depthScale';

export interface DepthRulerProps {
  /** 这一段的起点位次（小数点后第几位，1-based） */
  position: number;
  /** 结论成立的最大深度：离线答案表深度，或本轮实时扫描的覆盖深度 */
  depth: number;
  /** 这一段高亮的是哪种写法 */
  label: string;
  digits: string;
  tentative?: boolean;
}

/** 位次深度尺：用对数刻度说明「这个位次离数据源尽头有多远」。 */
export function DepthRuler({ position, depth, label, digits, tentative }: DepthRulerProps) {
  const percent = logDepthPercent(position, depth);
  const ticks = depthTicks(depth);
  const deepPercent = Math.round(percent);
  // 标尺两端没有余量，标记文字向内对齐，免得被裁掉
  const align = percent < 10 ? ' is-left' : percent > 90 ? ' is-right' : '';

  return (
    <div className="ruler">
      <div className="ruler-head">
        <span className="ruler-title">位次深度尺</span>
        <span className="ruler-sub">对数刻度 · 1 位 → 前 {withUnit(depth, '位')}</span>
      </div>
      <div className="ruler-track" aria-hidden="true">
        <div className="ruler-line" />
        {ticks.map((tick, index) => {
          const edge = index === 0 ? ' is-first' : index === ticks.length - 1 ? ' is-last' : '';
          return (
            <div
              key={tick.value}
              className={'ruler-tick' + edge}
              style={{ left: tick.percent.toFixed(3) + '%' }}
            >
              <span className="ruler-tick-label">{tick.label}</span>
            </div>
          );
        })}
        <div className={'ruler-marker' + align} style={{ left: percent.toFixed(3) + '%' }}>
          <span className="ruler-marker-label">第 {formatThousands(position)} 位</span>
        </div>
      </div>
      <p className="ruler-foot">
        <code>{label}</code> <code>{digits}</code> 落在这里：{tentative ? '暂定' : '已确认'}位次在对数尺上约 {deepPercent}% 处。
        位次越靠右，说明它在 π 里藏得越深。
      </p>
    </div>
  );
}

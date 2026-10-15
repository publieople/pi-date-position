import { useEffect, useState } from 'react';
import { lookupAnswers, type DateAnswers } from '../lib/answers';

export interface TableState {
  /** 属于当前日期的那张表；还没取到、或这一轮取表失败时为 null */
  table: DateAnswers | null;
  /** 表这一轮还没有结果（成功或失败都算有结果）：首屏靠它避免报完又被整条换掉 */
  waiting: boolean;
  /** 已经属于这一天、却没有表：说明这一轮取表失败（网络或格式问题），页面要如实说一声 */
  missing: boolean;
}

/**
 * 按日期取离线预计算答案表。
 *
 * 换日期时先把上一份答案清空（answersDate 只认属于当前日期的那一份），
 * 免得那一帧把上一天的表答案并进这一天的结论。失败（表没生成 / 格式不认识 / 网络问题）
 * 也算「这一轮有结果」：页面退回纯实时扫描的答案，但不会再等下去。
 */
export function useAnswersForDate(date: Date, activeKey: string): TableState {
  const [answers, setAnswers] = useState<DateAnswers | null>(null);
  const [answersDate, setAnswersDate] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setAnswers(null);
    setAnswersDate(null);
    lookupAnswers(date.getFullYear(), date.getMonth() + 1, date.getDate()).then(
      (value) => {
        if (alive) {
          setAnswers(value);
          setAnswersDate(activeKey);
        }
      },
      () => {
        if (alive) {
          setAnswers(null);
          setAnswersDate(activeKey);
        }
      },
    );
    return () => {
      alive = false;
    };
  }, [date, activeKey]);

  return {
    table: answers && answersDate === activeKey ? answers : null,
    waiting: answersDate !== activeKey,
    missing: answersDate === activeKey && answers === null,
  };
}

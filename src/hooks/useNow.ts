import { useEffect, useState } from 'react';

/** 每秒刷新的当前时间。用于「实时取当天日期」以及跨零点自动切换。 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

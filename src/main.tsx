import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ANSWER_RANGE, loadYearTable } from './lib/answers';
import { parseDateKey } from './lib/position';
import './styles.css';

// 有 JS 时才让入场动画的初始态生效：没有 JS 时内容默认可见（CSS 兜底）。
document.documentElement.classList.add('js-motion');

// 首屏那个数字要等离线答案表（manifest + 那一年份的那份），这里在 React 挂载前就先开始取
// （loader 内部按年份缓存，useAnswersForDate 拿到的是同一个 promise），把等待提前到脚本刚求值的那一帧。
// 深链 ?date= 指向别的年份时预取那一年，别白取当年表；失败不处理，报错与降级由 useAnswersForDate 负责。
function prefetchYear(): number {
  try {
    const key = new URLSearchParams(window.location.search).get('date');
    const date = key ? parseDateKey(key) : null;
    if (date) {
      return Math.min(ANSWER_RANGE.toYear, Math.max(ANSWER_RANGE.fromYear, date.getFullYear()));
    }
  } catch {
    // 地址栏解析失败就退回当年
  }
  return new Date().getFullYear();
}

void loadYearTable(prefetchYear()).catch(() => undefined);

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 容器');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

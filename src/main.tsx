import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { loadYearTable } from './lib/answers';
import './styles.css';

// 有 JS 时才让入场动画的初始态生效：没有 JS 时内容默认可见（CSS 兜底）。
document.documentElement.classList.add('js-motion');

// 首屏那个数字要等离线答案表（manifest + 当年那份），这里在 React 挂载前就先开始取
// （loader 内部按年份缓存，useAnswersForDate 拿到的是同一个 promise），把等待提前到脚本刚求值的那一帧。
// 失败不处理：取表本身由 useAnswersForDate 负责报错与降级提示。
void loadYearTable(new Date().getFullYear()).catch(() => undefined);

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 容器');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

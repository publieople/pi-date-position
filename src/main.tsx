import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// 有 JS 时才让入场动画的初始态生效：没有 JS 时内容默认可见（CSS 兜底）。
document.documentElement.classList.add('js-motion');

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 容器');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);

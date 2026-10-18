import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';
import App from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('缺少 #root 挂载点');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

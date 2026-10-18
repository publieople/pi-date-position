import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

export function getInitialTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    window.localStorage.setItem('pi-theme', theme);
  } catch (error) {
    void error;
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'dark' ? '#0f1115' : '#f4f0e6');
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((previous) => (previous === 'light' ? 'dark' : 'light'));
  }, []);

  return [theme, toggle];
}

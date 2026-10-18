import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5273 },
  preview: { host: '127.0.0.1', port: 5274 },
  build: { target: 'es2022', sourcemap: false },
  test: { environment: 'node', include: ['src/test/**/*.test.ts'] },
});

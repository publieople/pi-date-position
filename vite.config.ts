import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error 纯 ESM 的零依赖服务模块（无类型声明）
import { createPiService } from './server/pi-service.mjs';

const projectRoot = import.meta.dirname;

export default defineConfig({
  // 显式绑定 IPv4 环回：默认的 localhost 在本机只解析到 ::1，浏览器有时会先试 127.0.0.1
  server: { host: '127.0.0.1', port: 5273, strictPort: false },
  preview: { host: '127.0.0.1', port: 5274 },
  build: { target: 'es2022', sourcemap: false },
  plugins: [
    react(),
    {
      name: 'pi-digit-service',
      configureServer(server) {
        const service = createPiService({ projectRoot });
        server.middlewares.use(service.middleware);
      },
      configurePreviewServer(server) {
        const service = createPiService({ projectRoot });
        server.middlewares.use(service.middleware);
      },
    },
  ],
});

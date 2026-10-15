// 生产模式：静态服务 dist/ + 同源的 π 中间件。用法：node scripts/serve.mjs [--port 5274]
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { createPiService } from '../server/pi-service.mjs';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const argPort = process.argv.indexOf('--port');
const port = Number(argPort > -1 ? process.argv[argPort + 1] : process.env.PORT ?? 5274);
const host = process.env.HOST ?? '127.0.0.1';

if (!existsSync(join(dist, 'index.html'))) {
  console.error('先执行 pnpm build 生成 dist/（当前找不到 ' + join(dist, 'index.html') + '）');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=ascii',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const service = createPiService({
  projectRoot: root,
  log: (message) => console.log('[pi] ' + message),
});

function serveStatic(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = resolve(dist, '.' + pathname);
  if (!filePath.startsWith(dist + sep) && filePath !== dist) {
    res.statusCode = 403;
    res.end('forbidden');
    return;
  }
  const finalPath = existsSync(filePath) && statSync(filePath).isFile() ? filePath : join(dist, 'index.html');
  const type = MIME[extname(finalPath).toLowerCase()] ?? 'application/octet-stream';
  res.statusCode = 200;
  res.setHeader('content-type', type);
  res.setHeader('cache-control', finalPath.endsWith('index.html') ? 'no-store' : 'public, max-age=3600');
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(finalPath).pipe(res);
}

const server = createServer((req, res) => {
  service.middleware(req, res, () => {
    try {
      serveStatic(req, res);
    } catch (error) {
      res.statusCode = 500;
      res.end('server error: ' + error.message);
    }
  });
});

server.listen(port, host, () => {
  console.log('π 里的今天：http://' + host + ':' + port);
  console.log('缓存目录：' + service.cacheDir);
});

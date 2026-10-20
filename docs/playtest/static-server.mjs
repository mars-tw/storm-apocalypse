import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const host = '127.0.0.1';
const port = Number(process.env.PLAYTEST_PORT || 4177);
const root = resolve(process.cwd(), 'dist');
const base = '/storm-apocalypse';

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.bin', 'application/octet-stream'],
  ['.mp3', 'audio/mpeg'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav'],
  ['.woff2', 'font/woff2'],
]);

function safeFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let relative = decoded.startsWith(`${base}/`)
    ? decoded.slice(base.length + 1)
    : decoded === base || decoded === `${base}/`
      ? 'index.html'
      : decoded.replace(/^\/+/, '');
  if (!relative || relative.endsWith('/')) relative += 'index.html';
  const candidate = normalize(join(root, relative));
  return candidate.startsWith(root) ? candidate : null;
}

const server = createServer((request, response) => {
  let file = safeFile(request.url || '/');
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    file = join(root, 'index.html');
  }
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', mime.get(extname(file).toLowerCase()) || 'application/octet-stream');
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => {
  console.log(`PLAYTEST_SERVER http://${host}:${port}${base}/ root=${root}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

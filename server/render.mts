import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import handler from '../netlify/functions/api.mts';

const root = path.resolve(process.env.STATIC_DIR ?? 'artifacts/hustla-site-preview/dist/public');
const port = Number(process.env.PORT ?? 10000);

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error('payload too large');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function serveApi(req: http.IncomingMessage, res: http.ServerResponse) {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0] ?? 'http';
  const host = req.headers.host ?? 'localhost';
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  let body: Buffer | undefined;
  try { body = hasBody ? await readBody(req) : undefined; } catch { res.writeHead(413).end(); return; }
  const response = await handler(new Request(`${proto}://${host}${req.url}`, { method: req.method, headers, body }));
  const out: Record<string, string | string[]> = {};
  response.headers.forEach((value, key) => { if (key !== 'set-cookie') out[key] = value; });
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) out['set-cookie'] = cookies;
  res.writeHead(response.status, out);
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  let file = path.join(root, pathname);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) { file = path.join(file, 'index.html'); info = await stat(file).catch(() => null); }
  if (!info?.isFile()) {
    // Single-page app: unknown paths without a file extension get index.html
    if (path.extname(pathname)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return; }
    file = path.join(root, 'index.html');
  }
  const data = await readFile(file);
  const ext = path.extname(file).toLowerCase();
  const immutable = pathname.startsWith('/assets/') && ext !== '.html';
  res.writeHead(200, {
    'content-type': types[ext] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  res.end(req.method === 'HEAD' ? undefined : data);
}

http.createServer(async (req, res) => {
  try {
    const pathname = (req.url ?? '/').split('?')[0];
    if (pathname === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }).end('ok'); return; }
    if (pathname === '/api' || pathname.startsWith('/api/')) await serveApi(req, res);
    else await serveStatic(req, res);
  } catch (error) {
    console.error('server error', error);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Server error');
  }
}).listen(port, () => console.log(`HUSTLA listening on ${port}, serving ${root}`));

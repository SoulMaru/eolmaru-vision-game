import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8765);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.wasm':'application/wasm', '.task':'application/octet-stream', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.ogg':'audio/ogg', '.mp3':'audio/mpeg', '.wav':'audio/wav' };
const server = http.createServer(async (req, res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const base = pathname.startsWith('/src/') ? path.join(root,'src') : path.join(root,'public');
    const relative = pathname.startsWith('/src/') ? pathname.slice(5) : pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(base, relative);
    if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const headers = {
      'Content-Type':types[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
      'Permissions-Policy':'camera=(self), microphone=()',
      'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'",
      'Accept-Ranges':'bytes', 'Cache-Control':'no-cache'
    };
    const range = req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    if (range) {
      const start = Number(range[1]), end = Math.min(Number(range[2] || info.size-1), info.size-1);
      if (start > end || start >= info.size) { res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end(); return; }
      res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${info.size}`,'Content-Length':end-start+1});
      if (req.method === 'HEAD') res.end(); else createReadStream(file,{start,end}).pipe(res);
    } else {
      res.writeHead(200,{...headers,'Content-Length':info.size});
      if(req.method === 'HEAD') res.end(); else createReadStream(file).pipe(res);
    }
  } catch { res.writeHead(404).end('Not found'); }
});
server.on('error', e => { console.error(e.code === 'EADDRINUSE' ? `Port ${port} is in use. Open http://127.0.0.1:${port} or set PORT.` : e.message); process.exit(1); });
server.listen(port,'127.0.0.1',() => console.log(`Eolmaru Vision: http://127.0.0.1:${port} (local only)`));

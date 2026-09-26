// node tools/dev-server.mjs [port]
//   /       the game from src/, with live reload and source maps
//   /dist   the assembled single file (what gets published)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SRC, page, appJs, appJsMap } from './assemble.mjs';

const PORT = Number(process.argv[2] || process.env.PORT || 5179);
const TYPES = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.json': 'application/json' };
const RELOAD = `<script>(()=>{const es=new EventSource('/__reload');es.onmessage=()=>location.reload();})();</script>\n`;

// Live reload, only when some file's contents really changed: OneDrive touches
// files while syncing, and a plain fs.watch would reload the page over and over.
const clients = new Set();
function snapshot() {
  const out = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { try { out.push(f + '\0' + fs.readFileSync(f, 'utf8')); } catch (err) {} } } };
  walk(SRC);
  return out.join('\0\0');
}
let lastSnap = snapshot(), reloadTimer = null;
fs.watch(SRC, { recursive: true }, () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    const snap = snapshot();
    if (snap === lastSnap) return;
    lastSnap = snap;
    for (const res of clients) res.write('data: reload\n\n');
  }, 150);
});

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    if (p === '/' || p === '/index.html') return send(res, 200, 'text/html', page({ dev: true }).replace('</body>', RELOAD + '</body>'));
    if (p === '/dist' || p === '/dist/') return send(res, 200, 'text/html', page().replace('</body>', RELOAD + '</body>'));
    if (p === '/app.js') return send(res, 200, 'text/javascript', appJs() + '//# sourceMappingURL=/app.js.map\n');
    if (p === '/app.js.map') return send(res, 200, 'application/json', appJsMap());
    if (p === '/__reload') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(': hi\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (p.startsWith('/src/')) {
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return send(res, 404, 'text/plain', 'not found');
      return send(res, 200, TYPES[path.extname(f)] || 'application/octet-stream', fs.readFileSync(f));
    }
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    send(res, 404, 'text/plain', 'not found');
  } catch (e) {
    console.error(e);
    send(res, 500, 'text/plain', String(e && e.stack || e));
  }
}).listen(PORT, () => {
  console.log(`Crowded Market dev server\n  http://localhost:${PORT}/        the game from src/\n  http://localhost:${PORT}/dist    the assembled single file`);
});

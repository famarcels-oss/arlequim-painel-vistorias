#!/usr/bin/env node
/* Servidor local simples para testar a pasta public/ (npm run serve). Usa os mesmos cabeçalhos do vercel.json. */
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..', 'public');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const hdrs = {}; cfg.headers[0].headers.forEach((h) => { hdrs[h.key] = h.value; });
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const porta = +process.argv[2] || 8080;
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, path.normalize(p));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('não encontrado'); }
  res.writeHead(200, Object.assign({ 'Content-Type': tipos[path.extname(f)] || 'application/octet-stream' }, hdrs));
  fs.createReadStream(f).pipe(res);
}).listen(porta, () => console.log('Painel em http://localhost:' + porta));

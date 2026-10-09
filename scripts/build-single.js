#!/usr/bin/env node
/* Junta index.html + CSS + scripts em UM arquivo (dist/painel-vistorias.html), que abre offline com dois cliques. */
const fs = require('fs');
const path = require('path');
const pub = path.join(__dirname, '..', 'public');
let html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => '<style>\n' + fs.readFileSync(path.join(pub, href), 'utf8') + '\n</style>');
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) => '<script>\n' + fs.readFileSync(path.join(pub, src), 'utf8').replace(/<\/script/gi, '<\\/script') + '\n</script>');
const dist = path.join(__dirname, '..', 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'painel-vistorias.html'), html);
console.log('dist/painel-vistorias.html', (html.length / 1024).toFixed(0) + ' KB');

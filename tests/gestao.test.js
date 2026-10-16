/* Testes da visão gestão e das regras pétreas: o painel só lê, nada some, dado que falta não vira zero. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const JSZip = require('../public/assets/vendor/jszip.min.js');
const R = require('../public/assets/js/regras.js');
const N = require('../public/assets/js/normalizar.js');
const D = require('../public/assets/js/dados.js');
const G = require('../public/assets/js/gestao.js');
const V = require('../public/assets/js/views.js');
const VGraw = require('../public/assets/js/views-gestao.js');
// as telas devolvem { band, corpo, cls }; os testes olham o HTML inteiro (faixa + corpo)
const juntaTela = (f) => (C) => { const t = f(C); assert.ok(t && typeof t.band === 'string' && typeof t.corpo === 'string' && typeof t.cls === 'string'); return t.band + t.corpo; };
const VG = { viewHome: juntaTela(VGraw.viewHome), viewProjetoG: juntaTela(VGraw.viewProjetoG), viewFicha: juntaTela(VGraw.viewFicha), textoCopiavel: VGraw.textoCopiavel, ABAS: VGraw.ABAS };

const raiz = path.join(__dirname, '..');
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'amostra-g-'));
execFileSync('node', [path.join(raiz, 'scripts', 'gerar-amostra.js'), pasta], { stdio: 'pipe' });

async function carregar(banco, arquivo) {
  const buf = fs.readFileSync(path.join(pasta, arquivo));
  if (arquivo.endsWith('.zip')) { const r = await N.lerZip(buf, JSZip, arquivo); return banco.adicionar(r.vistorias, r.pacoteId); }
  return banco.adicionar(N.lerCsvAntigo(buf.toString('utf8'), arquivo));
}
function congelar(o, visto = new Set()) {
  if (!o || typeof o !== 'object' || visto.has(o)) return o;
  visto.add(o);
  Object.keys(o).forEach((k) => { if (k !== 'zipRef' && k !== 'embut') congelar(o[k], visto); });
  return Object.freeze(o);
}
function foto(banco) {
  return JSON.stringify(banco.todas().map((v) => { const c = Object.assign({}, v); delete c.zipRef; delete c.embut; return c; }).sort((a, b) => (a.chave < b.chave ? -1 : 1)));
}
function contexto(banco, S) {
  const escolas = banco.escolas(); const projetos = [];
  escolas.forEach((e) => { const p = V.nomeProjeto(e.ultima); if (!projetos.includes(p)) projetos.push(p); });
  return { S, escolas, projetos: projetos.sort(), todas: banco.todas(), vistoriaSelecionada: (e) => e.ultima };
}
const estado = (extra) => Object.assign({ view: 'geral', projeto: null, aberto: null, aba: 'resumo', sel: {}, gAba: 'visao', gTipo: 'todas', gFiltro: 'todas', gVer: {}, ficha: null, pin: null, no: null, foto: null, pdf: false }, extra);

// vistoria mínima para testar contas sem depender dos arquivos de amostra
let seq = 0;
function mk(o) {
  seq++;
  const nota = o.nota === undefined ? 70 : o.nota;
  const faixa = o.faixa || (nota == null ? 'nm' : R.faixaDaNota(nota));
  return {
    chave: o.chave || 'u' + seq, uuid: o.chave || 'u' + seq, origem: o.origem || 'pacote', escola: o.escola || 'Escola ' + seq, projeto: o.projeto === undefined ? 'P1' : o.projeto,
    data: o.data === undefined ? Date.UTC(2026, 5, 10) : o.data, atualizadoEm: o.data === undefined ? Date.UTC(2026, 5, 10) : o.data, placeId: null, campos: 'completa',
    tecnico: { nome: null, email: null }, versaoApp: null, aparelho: null, arquivos: { fotos: {}, espectro: [] },
    censo: { alunos: o.alunos === undefined ? 100 : o.alunos }, infra: Object.assign({ switch: 'Switch Gigabit', gateway: 'Solução profissional', densidadeAps: 'Sala de aula', espectroWifi: '2.4 GHz + 5 GHz', notaProfessor: '8' }, o.infra || {}),
    links: o.links || [], wifi: Object.assign({ medido: true, pontos: [{ nome: 'S1', download: 90, ping: 20, jitter: 5 }], mediaDownload: 90, mediaPing: 20, mediaUpload: null }, o.wifi || {}),
    cabeada: Object.assign({ possui: false, redes: [] }, o.cabeada || {}), conclusao: Object.assign({ possuiImpeditivo: false }, o.conclusao || {}),
    calculado: { nota, faixa, notaWifi: o.notaWifi === undefined ? nota : o.notaWifi, notaCabeada: o.notaCabeada === undefined ? null : o.notaCabeada }
  };
}
function banco(lista) { const b = D.criar(); b.adicionar(lista); return b; }

// ── regras pétreas ───────────────────────────────────────────────────────────
test('arquivos protegidos da leitura de dados não mudaram', () => {
  fs.readFileSync(path.join(raiz, 'docs', 'protegidos.sha256'), 'utf8').trim().split('\n').forEach((linha) => {
    const [sha, arq] = linha.trim().split(/\s+/);
    const atual = crypto.createHash('sha256').update(fs.readFileSync(path.join(raiz, arq))).digest('hex');
    assert.strictEqual(atual, sha, arq + ' mudou. Se foi de propósito, atualize docs/protegidos.sha256 com a justificativa.');
  });
});

test('camada de gestão não escreve no banco nem apaga nada', () => {
  ['gestao.js', 'views-gestao.js'].forEach((f) => {
    const src = fs.readFileSync(path.join(raiz, 'public', 'assets', 'js', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/\.adicionar\s*\(|\.limpar\s*\(|\bdelete\s+\w|localStorage|indexedDB|fetch\s*\(/.test(src), f + ' tenta escrever, apagar ou sair da memória');
  });
});

test('gestão roda sobre vistorias congeladas sem tentar alterar nada', async () => {
  const b = D.criar();
  for (const a of ['planilha_antiga.csv', 'pacote_tecnico_A.zip', 'pacote_tecnico_B.zip']) await carregar(b, a);
  b.todas().forEach((v) => congelar(v));
  const C = contexto(b, estado({ view: 'projeto', projeto: 'Projeto Alfa' }));
  assert.doesNotThrow(() => {
    G.visaoGeral(C.escolas);
    VG.viewHome(C);
    ['visao', 'escolas', 'melhorias', 'historico'].forEach((aba) => { C.S.gAba = aba; VG.viewProjetoG(C); });
    C.escolas.forEach((e) => { C.S.ficha = e.chave; C.S.aberto = e.chave; VG.viewFicha(C); });
  });
});

test('banco idêntico antes e depois de calcular e desenhar tudo', async () => {
  const b = D.criar();
  for (const a of ['planilha_antiga.csv', 'pacote_tecnico_A.zip', 'pacote_tecnico_B.zip']) await carregar(b, a);
  const antes = foto(b), nAntes = b.escolas().map((e) => e.serie.length);
  const C = contexto(b, estado({ view: 'projeto', projeto: 'Projeto Alfa' }));
  G.visaoGeral(C.escolas); VG.viewHome(C); VG.viewProjetoG(C);
  C.escolas.forEach((e) => { C.S.ficha = e.chave; C.S.aberto = e.chave; VG.viewFicha(C); });
  assert.strictEqual(foto(b), antes);
  assert.deepStrictEqual(b.escolas().map((e) => e.serie.length), nAntes, 'o histórico de cada escola continua inteiro');
});

test('carregar o mesmo pacote de novo não muda nada na visão de gestão', async () => {
  const b = D.criar();
  await carregar(b, 'pacote_tecnico_A.zip'); await carregar(b, 'pacote_tecnico_B.zip');
  const antes = JSON.stringify(G.visaoGeral(b.escolas()).geral);
  await carregar(b, 'pacote_tecnico_A.zip'); await carregar(b, 'pacote_tecnico_B.zip');
  assert.strictEqual(JSON.stringify(G.visaoGeral(b.escolas()).geral), antes);
});

// ── telas sem lixo, com dado faltando ────────────────────────────────────────
for (const [nome, arquivos] of [['só planilha antiga', ['planilha_antiga.csv']], ['só pacote novo', ['pacote_tecnico_A.zip']], ['tudo junto', ['planilha_antiga.csv', 'pacote_tecnico_A.zip', 'pacote_tecnico_B.zip']]]) {
  test('telas novas sem undefined, NaN, null ou travessão: ' + nome, async () => {
    const b = D.criar();
    for (const a of arquivos) await carregar(b, a);
    const C = contexto(b, estado());
    const htmls = [VG.viewHome(C)];
    C.projetos.forEach((p) => {
      C.S.view = 'projeto'; C.S.projeto = p;
      ['visao', 'escolas', 'melhorias', 'historico'].forEach((aba) => { C.S.gAba = aba; ['todas', 'wifi', 'hib', 'fis'].forEach((t) => { C.S.gTipo = t; htmls.push(VG.viewProjetoG(C)); }); });
    });
    C.escolas.forEach((e) => { C.S.view = 'ficha'; C.S.ficha = e.chave; htmls.push(VG.viewFicha(C)); });
    htmls.forEach((h) => assert.ok(!/undefined|NaN|\bnull\b|—|–/.test(h.replace(/<[^>]*>/g, ' ')), 'lixo na tela: ' + (h.replace(/<[^>]*>/g, ' ').match(/.{0,40}(undefined|NaN|\bnull\b|—|–).{0,40}/) || [''])[0]));
  });
}

// ── contas ───────────────────────────────────────────────────────────────────
test('tipo de rede: híbrida, só Wi-Fi, só rede física e sem medição', () => {
  const hib = mk({ cabeada: { possui: true, redes: [{ nome: 'Lab', download: 95, ping: 20, switch: 'Gigabit' }] }, notaCabeada: 95 });
  const wifi = mk({});
  const fis = mk({ wifi: { medido: false, pontos: [], mediaDownload: null, mediaPing: null }, cabeada: { possui: true, redes: [{ nome: 'Lab', download: 95, ping: 20 }] }, notaWifi: null, notaCabeada: 95, nota: 95 });
  const nenhum = mk({ wifi: { medido: false, pontos: [], mediaDownload: null, mediaPing: null }, nota: null });
  assert.deepStrictEqual([hib, wifi, fis, nenhum].map(G.tipoRede), ['hib', 'wifi', 'fis', 'nenhum']);
});

test('resumo: alunos que faltam ficam fora da soma, nunca viram zero', () => {
  const b = banco([mk({ escola: 'A', nota: 90, alunos: 100 }), mk({ escola: 'B', nota: 30, alunos: null }), mk({ escola: 'C', nota: 40, alunos: 50 }), mk({ escola: 'D', nota: 60, alunos: 10 })]);
  const r = G.resumo(G.linhasDe(b.escolas()));
  assert.strictEqual(r.n, 4);
  assert.deepStrictEqual([r.p, r.a, r.b], [1, 1, 2]);
  assert.strictEqual(r.alB, 50, 'só a escola bloqueada com aluno registrado entra');
  assert.strictEqual(r.alunos, 160);
  assert.strictEqual(r.nComAlunos, 3);
  assert.strictEqual(r.notaMedia, 55);
});

test('escola sem nota fica fora da prontidão e das médias', () => {
  const b = banco([mk({ escola: 'A', nota: 85 }), mk({ escola: 'SEMED', nota: null, wifi: { medido: false, pontos: [], mediaDownload: null, mediaPing: null } })]);
  const r = G.resumo(G.linhasDe(b.escolas()));
  assert.strictEqual(r.total, 2); assert.strictEqual(r.n, 1); assert.strictEqual(r.semNota, 1); assert.strictEqual(r.notaMedia, 85);
});

test('faixa de gestão segue a régua do app: 80, 51 e 50', () => {
  const b = banco([80, 79, 51, 50].map((n, i) => mk({ escola: 'E' + i, nota: n })));
  const f = {}; G.linhasDe(b.escolas()).forEach((l) => { f[l.nome] = l.faixa; });
  assert.deepStrictEqual(f, { E0: 'ap', E1: 're', E2: 're', E3: 'rp' });
  assert.deepStrictEqual([G.ROTULOS.ap, G.ROTULOS.re, G.ROTULOS.rp], ['Apta', 'Com ajustes', 'Severas restrições']);
});

test('causas: cada teste usa só campo registrado; campo ausente não vira causa', () => {
  const ruim = mk({ infra: { switch: 'Switch Fast 10/100', gateway: 'Modem da operadora', densidadeAps: 'Corredor / Distante', espectroWifi: 'Apenas 2.4 GHz', notaProfessor: '4' }, wifi: { mediaDownload: 20, mediaPing: 70, pontos: [{ nome: 'S', download: 20, ping: 70 }] }, conclusao: { possuiImpeditivo: true } });
  assert.deepStrictEqual(G.causasDaEscola(ruim).map((c) => c.id).sort(), ['aps', 'dl', 'esp24', 'gateway', 'imped', 'lat', 'prof', 'switch']);
  const antiga = mk({ origem: 'planilha', infra: { switch: null, gateway: null, densidadeAps: null, espectroWifi: null, notaProfessor: null }, conclusao: { possuiImpeditivo: null } });
  assert.deepStrictEqual(G.causasDaEscola(antiga).map((c) => c.id), []);
});

test('causas do projeto contam só escolas com nota e ordenam por quantas atingem', () => {
  const gw = { infra: { gateway: 'Modem da operadora' } };
  const b = banco([mk(Object.assign({ escola: 'A', nota: 40 }, gw)), mk(Object.assign({ escola: 'B', nota: 45 }, gw)), mk({ escola: 'C', nota: 90, infra: { densidadeAps: 'Corredor / Distante' } }),
    mk(Object.assign({ escola: 'Sem nota', nota: null, wifi: { medido: false, pontos: [], mediaDownload: null, mediaPing: null } }, gw))]);
  const c = G.causasDoProjeto(G.linhasDe(b.escolas()));
  assert.deepStrictEqual(c.map((x) => [x.id, x.qtd, x.de]), [['gateway', 2, 3], ['aps', 1, 3]]);
});

test('prioridade: pior nota com mais alunos primeiro, só abaixo de 80', () => {
  const b = banco([mk({ escola: 'Grande ruim', nota: 30, alunos: 800 }), mk({ escola: 'Pequena ruim', nota: 20, alunos: 50 }), mk({ escola: 'Boa', nota: 95, alunos: 900 }), mk({ escola: 'Sem aluno', nota: 10, alunos: null })]);
  const p = G.prioridade(G.linhasDe(b.escolas()), 5).map((x) => x.l.nome);
  assert.deepStrictEqual(p, ['Grande ruim', 'Pequena ruim', 'Sem aluno']);
});

test('filtro por tipo de rede soma o total', () => {
  const lab = { cabeada: { possui: true, redes: [{ nome: 'Lab', download: 95, ping: 20 }] }, notaCabeada: 95 };
  const b = banco([mk({ escola: 'A' }), mk({ escola: 'B' }), mk(Object.assign({ escola: 'C' }, lab))]);
  const c = G.contagemTipos(G.linhasDe(b.escolas()));
  assert.deepStrictEqual(c, { todas: 3, wifi: 2, hib: 1, fis: 0 });
  assert.strictEqual(c.wifi + c.hib + c.fis, c.todas);
});

test('rodadas agrupam por proximidade de data e o histórico da escola fica inteiro', () => {
  const dia = 86400000, t0 = Date.UTC(2026, 5, 1);
  const b = banco([
    mk({ escola: 'A', chave: 'a1', data: t0, nota: 50 }), mk({ escola: 'A', chave: 'a2', data: t0 + 90 * dia, nota: 70 }),
    mk({ escola: 'B', chave: 'b1', data: t0 + 2 * dia, nota: 60 }), mk({ escola: 'B', chave: 'b2', data: t0 + 92 * dia, nota: 58 })]);
  const L = G.linhasDe(b.escolas());
  const rs = G.rodadas(L);
  assert.strictEqual(rs.length, 2);
  assert.deepStrictEqual(rs.map((r) => [r.medicoes, r.escolas, r.notaMedia]), [[2, 2, 55], [2, 2, 64]]);
  const ev = G.evolucao(L);
  assert.strictEqual(ev.n, 2); assert.strictEqual(ev.melhoraram, 1); assert.strictEqual(ev.pioraram, 1); assert.strictEqual(ev.media, 9);
  assert.strictEqual(L.find((l) => l.nome === 'A').medicoes, 2);
});

test('sem segunda medição não há evolução inventada', () => {
  const b = banco([mk({ escola: 'A' }), mk({ escola: 'B' })]);
  assert.strictEqual(G.evolucao(G.linhasDe(b.escolas())), null);
});

test('ficha mostra o detalhe da versão anterior sempre aberto, sem botão Detalhar', () => {
  const b = banco([mk({ escola: 'A', cabeada: { possui: true, redes: [{ nome: 'Lab', download: 95, ping: 20 }] }, notaCabeada: 95 })]);
  const C = contexto(b, estado({ view: 'ficha', projeto: 'P1' })); const e = C.escolas[0];
  C.S.ficha = e.chave;
  const h = VG.viewFicha(C);
  assert.ok(!h.includes('Detalhar') && !/data-act="abrir"/.test(h));
  ['Resumo', 'Pontos Wi-Fi', 'Rede cabeada', 'Topologia de rede', 'Sugestões de melhorias', 'Espectro', 'Fotos', 'PDF e arquivos'].forEach((t) => assert.ok(h.includes(t), 'falta a aba ' + t));
  assert.ok(h.includes('data-act="exportarEscopo" data-arg="escola"') && h.includes('Exportar escola em HTML'));
});

test('projeto tem exportar projeto em HTML e nenhum resumo tem Copiar texto', () => {
  const b = banco([mk({ escola: 'A', nota: 21, alunos: 400 }), mk({ escola: 'B', nota: 90, alunos: 100 })]);
  const C = contexto(b, estado({ view: 'projeto', projeto: 'P1' }));
  C.S.gAba = 'visao';
  const h = VG.viewProjetoG(C);
  assert.ok(h.includes('data-act="exportarEscopo" data-arg="projeto"') && h.includes('Exportar projeto em HTML'));
  assert.ok(!h.includes('Copiar texto') && !h.includes('pronto para colar'));
});

test('listas fechadas mostram no máximo 5 itens (8 nas escolas, 3 nos projetos)', () => {
  const b = banco(Array.from({ length: 12 }, (_, i) => mk({ escola: 'Escola ' + i, nota: 20 + i * 3, alunos: 100 + i, projeto: 'P' + (i % 5), infra: { gateway: 'Modem da operadora', densidadeAps: i % 2 ? 'Corredor / Distante' : 'Sala' } })));
  const C = contexto(b, estado());
  const conta = (h, re) => (h.match(re) || []).length;
  assert.strictEqual(conta(VG.viewHome(C), /data-act="abrirProjeto"/g), 3);
  C.S.view = 'projeto'; C.S.projeto = 'P0'; C.S.gAba = 'escolas';
  assert.ok(conta(VG.viewProjetoG(C), /data-act="abrirFicha"/g) <= 8);
  const grande = banco(Array.from({ length: 20 }, (_, i) => mk({ escola: 'Esc ' + i, nota: 20 + i, alunos: 100 })));
  const C2 = contexto(grande, estado({ view: 'projeto', projeto: 'P1', gAba: 'escolas' }));
  assert.strictEqual(conta(VG.viewProjetoG(C2), /data-act="abrirFicha"/g), 8);
  C2.S.gVer.escolas = true;
  assert.strictEqual(conta(VG.viewProjetoG(C2), /data-act="abrirFicha"/g), 20);
});

// ── fidelidade ao mockup aprovado ─────────────────────────────────────────────
test('nome em maiúsculas vira Nome Próprio só na tela, mantendo siglas', () => {
  assert.strictEqual(G.nomeEscola('CEI CASSIO MAGNANI'), 'CEI Cassio Magnani');
  assert.strictEqual(G.nomeEscola('ESCOLA MUNICIPAL DULCE DOS SANTOS'), 'Escola Municipal Dulce dos Santos');
  assert.strictEqual(G.nomeEscola('E.M Aurea'), 'E.M Aurea');
});

test('ficha: diagnóstico, posição no projeto e causas por tipo', () => {
  const b = banco([mk({ escola: 'A', nota: 21, alunos: 400 }), mk({ escola: 'B', nota: 70, alunos: 100 }), mk({ escola: 'C', nota: 90, alunos: 100 })]);
  const L = G.linhasDe(b.escolas());
  const a = L.filter((l) => l.nome === 'A')[0], c = L.filter((l) => l.nome === 'C')[0];
  assert.ok(/Maior prioridade do projeto, em um ranking de 3 escolas/.test(G.posicao(L, a)));
  assert.ok(/Melhor nota do projeto/.test(G.posicao(L, c)));
  assert.ok(G.diagnostico(a).length > 20 && !/undefined|NaN/.test(G.diagnostico(a)));
  G.causasPorTipo(a.v).forEach((x) => assert.ok(x.grupo && x.item && x.valor != null));
});

test('ponto com 0 Mbps é falta de rede na visita, não medição de qualidade', () => {
  const b = banco([mk({ escola: 'Sem rede', nota: 44, wifi: { medido: true, mediaDownload: 0, mediaPing: 0, pontos: [{ nome: 'Ponto 1', download: 0, ping: 0, jitter: 0 }] } })]);
  const l = G.linhasDe(b.escolas())[0];
  assert.strictEqual(l.dl, null); assert.strictEqual(l.ping, null);
  assert.ok(G.semRede(l.v) && /Sem rede na visita/.test(G.diagnostico(l)));
  assert.ok(!G.causasDaEscola(l.v).some((c) => c.id === 'dl'));
});

test('telas seguem o mockup: faixa roxa, abas na faixa e coluna única (sem barra lateral)', () => {
  const b = banco([mk({ escola: 'A', nota: 21, alunos: 400 }), mk({ escola: 'B', nota: 90, alunos: 100 })]);
  const C = contexto(b, estado({ view: 'projeto', projeto: 'P1', gAba: 'escolas' }));
  const t = VGraw.viewProjetoG(C);
  assert.ok(t.band.includes('gv-band') && t.band.includes('gv-tabs') && !t.band.includes('Resumo para diretoria') &&t.band.includes('Todos os projetos'));
  assert.ok(t.corpo.includes('Tipo de rede') && t.corpo.includes('>Abrir<') && !t.corpo.includes('Abrir ficha'));
  C.S.view = 'ficha'; C.S.ficha = C.escolas[0].chave;
  const f = VGraw.viewFicha(C), html = f.band + f.corpo;
  ['Abrir relatório em PDF', 'Copiar resumo', 'Medições por ambiente', 'Causas identificadas', 'Situação', 'Evolução da nota', 'Arquivos', 'Vistoria'].forEach((x) => assert.ok(html.includes(x), 'falta ' + x));
  assert.ok(!/lateral|sidebar/i.test(html));
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'painel.css'), 'utf8');
  assert.ok(!/lateral|sidebar/i.test(css.slice(css.indexOf('Visão gestão'))));
});

test('copiar texto devolve o resumo sem undefined', () => {
  const b = banco([mk({ escola: 'A', nota: 21, alunos: 400 }), mk({ escola: 'B', nota: 90, alunos: 100 })]);
  const C = contexto(b, estado());
  const t1 = VG.textoCopiavel(C); assert.ok(t1.includes('Hoje') && !/undefined|NaN/.test(t1));
  C.S.view = 'projeto'; C.S.projeto = 'P1'; assert.ok(VG.textoCopiavel(C).startsWith('P1'));
  C.S.view = 'ficha'; C.S.ficha = C.escolas[0].chave; assert.ok(/Nota \d+ de 100/.test(VG.textoCopiavel(C)));
});

test('home sem botão Copiar texto, referências acima da prioridade, gráfico filtra a lista e ficha tem Voltar', () => {
  const b = banco([mk({ escola: 'A', nota: 21, alunos: 400 }), mk({ escola: 'B', nota: 90, alunos: 100 }), mk({ escola: 'C', nota: 60, alunos: 100 })]);
  const C = contexto(b, estado());
  assert.ok(!VG.viewHome(C).includes('Copiar texto'));
  C.S.view = 'projeto'; C.S.projeto = 'P1'; C.S.gAba = 'visao';
  const v = VG.viewProjetoG(C);
  assert.ok(v.indexOf('Escolas de referência') < v.indexOf('Prioridade de intervenção'));
  C.S.gAba = 'escolas';
  const e = VG.viewProjetoG(C);
  assert.ok(/class="gv-gb[^"]*" data-act="gFiltro" data-arg="ap"/.test(e) && /data-act="gTipo" data-arg="wifi"/.test(e));
  C.S.gFiltro = 'ap';
  assert.strictEqual((VG.viewProjetoG(C).match(/data-act="abrirFicha"/g) || []).length, 1);
  C.S.view = 'ficha'; C.S.ficha = C.escolas[0].chave; C.S.fichaOrigem = 'Escolas';
  assert.ok(/data-act="voltarProjeto" data-arg="escolas">[^<]*<svg[^>]*>.*Voltar para Escolas/s.test(VG.viewFicha(C)));
});

test('versão do painel aparece, discreta, na faixa de todas as telas e bate com o package.json', () => {
  const versao = require('../package.json').version;
  assert.strictEqual(V.VERSAO, versao);
  const b = banco([mk({ escola: 'Escola Versão', projeto: 'P1' })]);
  const C = contexto(b, estado({ view: 'geral', projeto: 'P1' }));
  const tem = (html) => assert.ok(html.includes('class="gv-ver"') && html.includes('v' + versao), 'selo da versão ausente');
  tem(VG.viewHome(C));
  tem(VG.viewProjetoG(Object.assign(C, { S: estado({ view: 'projeto', projeto: 'P1' }) })));
  const e = C.escolas[0];
  tem(VG.viewFicha(contexto(b, estado({ view: 'ficha', projeto: 'P1', ficha: e.chave, aberto: e.chave }))));
});

test('Visão executiva 1.2.0: resumo positivo, Histórico do projeto, maior ofensor, sem SEMED e sem KPI de evolução', () => {
  const d = (m, dia) => Date.UTC(2026, m, dia, 12);
  const link = (tam, mbps) => ({ links: [{ operadora: 'Op', tamanho: tam, mbps }] });
  const b = banco([
    mk({ chave: 'a1', escola: 'A', nota: 50, data: d(5, 9), alunos: 100, ...link('500 Mbps', 500) }), mk({ chave: 'a2', escola: 'A', nota: 90, data: d(9, 10), alunos: 100, ...link('500 Mbps', 500) }),
    mk({ chave: 'b1', escola: 'B', nota: 60, data: d(5, 9), alunos: 100, ...link('10 Giga', 10) }), mk({ chave: 'b2', escola: 'B', nota: 65, data: d(9, 10), alunos: 100, ...link('10 Giga', 10) }),
    mk({ chave: 'c1', escola: 'SEMED', nota: null, faixa: 'nm', data: d(5, 9), alunos: null, wifi: { medido: false, pontos: [], mediaDownload: null, mediaPing: null } })
  ]);
  const C = contexto(b, estado({ view: 'projeto', projeto: 'P1', gAba: 'visao' }));
  const t = VGraw.viewProjetoG(C), html = t.band + t.corpo;
  assert.ok(html.includes('Hoje 1 de 2 escolas medidas já sustentam VDI'));
  assert.ok(html.includes('Histórico do projeto') && html.includes('Escolas aptas para VDI: de 0 para 1') && !html.includes('melhoraram') && !html.includes('pioraram'));
  assert.ok(!html.includes('O que mais pesa') && !html.includes('SEMED') && !html.includes('Evolução desde a última medição'));
  assert.ok(!/Pronta|prontas/.test(html));
  // maior ofensor: link abaixo de 1 Gbps; "10 Giga" não conta como abaixo
  const o = G.maiorOfensor(G.linhasDe(b.escolas()));
  assert.strictEqual(o.nome, 'Link de internet abaixo de 1 Gbps'); assert.strictEqual(o.qtd, 1); assert.strictEqual(o.de, 2); assert.strictEqual(o.sem, 1);
  assert.ok(html.includes('Sugestões · maior ofensor') && html.includes('1 de 2'));
  // série de aptas por data
  const pts = G.serieAptas(G.linhasDe(b.escolas()));
  assert.deepStrictEqual(pts.map((p) => p.n), [0, 1]);
});

test('Resultado da leitura aparece só na aba Histórico (app.js)', () => {
  const src = fs.readFileSync(path.join(raiz, 'public', 'assets', 'js', 'app.js'), 'utf8');
  assert.ok(src.includes("S.view === 'projeto' && S.gAba === 'historico') h += painelLeitura()"));
  assert.strictEqual((src.match(/h \+= painelLeitura\(\)/g) || []).length, 2); // um no modo gestão (só Histórico) e um no clássico
});

test('Melhorias 1.2.1: aba renomeada, tipos somados e filtro leva à escola', () => {
  const V = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/assets/js/views-gestao.js'), 'utf8');
  const A = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/assets/js/app.js'), 'utf8');
  assert.match(V, /\['melhorias', 'Melhorias'\]/);
  assert.doesNotMatch(V, /\['causas', 'Causas'\]/);
  assert.match(V, /data-act="gMelhoria"/);
  assert.match(V, /data-act="abrirFicha"/);
  assert.match(A, /ACOES\.gMelhoria/);
});

test('Teste de carga 1.3.0: lê o campo do pacote, mostra na ficha, não mexe na nota, sem Plano de ação', () => {
  const j = { identificacao: { uuid: 'u-tc', dataVistoria: 1760000000000, schemaVersion: 26 }, local: { escola: 'Escola TC', projeto: 'P1' },
    testeCarga: { usuarios: 30, download: 42.5, upload: 38.1, ping: 18, jitter: 4.2, sinalDbm: -61, ssid: 'Escola_Wifi', banda: '5 GHz', dataMedicao: 1760000000000, resultado: 'Bom', motivo: 'Dentro do esperado.' } };
  const v = N.normalizarJson(j, 'p/', 'x.zip');
  assert.strictEqual(v.testeCarga.download, 42.5); assert.strictEqual(v.testeCarga.resultado, 'Bom'); assert.strictEqual(v.testeCarga.sinalDbm, -61);
  assert.strictEqual(N.normalizarJson({ identificacao: { uuid: 'u2' }, local: { escola: 'E' } }, 'p/', 'x.zip').testeCarga, null);
  assert.strictEqual(N.normalizarJson({ identificacao: { uuid: 'u3' }, local: { escola: 'E' }, testeCarga: null }, 'p/', 'x.zip').testeCarga, null);

  const b = banco([mk({ escola: 'A', nota: 70, alunos: 400 })]);
  const C = contexto(b, estado({ view: 'ficha', projeto: 'P1' })); C.S.ficha = C.escolas[0].chave; C.S.aba = 'pontos';
  let html = VG.viewFicha(C);
  assert.ok(html.includes('Teste de carga') && html.includes('Esta vistoria não tem teste de carga.') && !html.includes('Plano de ação'));
  const notaAntes = G.linhasDe(C.escolas)[0].nota;
  C.escolas[0].ultima.testeCarga = v.testeCarga;
  html = VG.viewFicha(C);
  assert.ok(html.includes('42,5') && html.includes('38,1') && html.includes('-61') && html.includes('Dentro do esperado.') && html.includes('rede Escola_Wifi'));
  assert.strictEqual(G.linhasDe(C.escolas)[0].nota, notaAntes);
  C.escolas[0].ultima.testeCarga = Object.assign({}, v.testeCarga, { sinalDbm: 0, upload: null, resultado: 'Ruim' });
  html = VG.viewFicha(C);
  assert.ok(html.includes('Ruim') && html.includes('Não registrado') && html.includes('Ignorado no resultado'));
});

test('Apta com ressalva 1.5.0: só quando o app diz apta e uma das duas partes veio com ressalva', () => {
  const calc = (o) => ({ calculado: Object.assign({ nota: 82, faixa: 'ap', notaWifi: 68, notaCabeada: 95, statusWifi: 'COM_RESSALVA', statusCabeada: 'APROVADO' }, o) });
  assert.strictEqual(G.ehMista(calc({}), 'hib', 'ap'), true);
  assert.strictEqual(G.ehMista(calc({}), 'hib', 're'), false, 'escola com ajustes no geral não vira apta');
  assert.strictEqual(G.ehMista(calc({}), 'wifi', 'ap'), false, 'precisa das duas notas');
  assert.strictEqual(G.ehMista(calc({ statusCabeada: 'REPROVADO' }), 'hib', 'ap'), false, 'parte reprovada não é ressalva');
  assert.strictEqual(G.ehMista(calc({ statusWifi: 'APROVADO' }), 'hib', 'ap'), false, 'duas aprovadas seguem aptas');
  assert.strictEqual(G.faixaParte('COM_RESSALVA'), 're');
  assert.strictEqual(G.faixaParte('NAVEGABILIDADE_ZERO'), null);
  assert.strictEqual(G.ROTULOS.apr, 'Apta com ressalva');
});

test('Severas restrições 1.5.0: o rótulo trocou em todas as telas de gestão', () => {
  const b = banco([mk({ escola: 'A', nota: 30, alunos: 400 }), mk({ escola: 'B', nota: 90, alunos: 100 })]);
  const C = contexto(b, estado({ view: 'projeto', projeto: 'P1', gAba: 'escolas' }));
  const html = VG.viewProjetoG(C);
  assert.ok(html.includes('Severas restrições'));
  assert.ok(!/Bloquead/.test(html), 'ainda sobrou "Bloqueada" na tela');
  const v = require('fs').readFileSync(require('path').join(raiz, 'public/assets/js/views.js'), 'utf8');
  assert.ok(!/ROT_GESTAO = .*Bloqueada/.test(v));
});

test('nota meio verde meio âmbar aparece na escola apta com ressalva', () => {
  const VGjs = require('fs').readFileSync(require('path').join(raiz, 'public/assets/js/views-gestao.js'), 'utf8');
  const css = require('fs').readFileSync(require('path').join(raiz, 'public/assets/painel.css'), 'utf8');
  assert.ok(/clsNota/.test(VGjs) && /gv-mista/.test(VGjs));
  assert.ok(/\.gv-n2\{[^}]*linear-gradient/.test(css) && /\.gv-mista\{/.test(css));
});

test('Prontidão para VDI 1.5.0: categoria própria, contagem separada e ficha sem responsável/revistoria', () => {
  const b = banco([mk({ escola: 'A', nota: 90, alunos: 100 }), mk({ escola: 'B', nota: 60, alunos: 50 })]);
  const C = contexto(b, estado({ view: 'projeto', projeto: 'P1', gAba: 'escolas' }));
  // marca a primeira como híbrida apta com ressalva, como o app entrega
  const alvo = C.escolas.filter((e) => /A/.test(e.ultima.escola))[0];
  Object.assign(alvo.ultima.calculado, { notaWifi: 68, notaCabeada: 95, statusWifi: 'COM_RESSALVA', statusCabeada: 'APROVADO' });
  alvo.ultima.cabeada.possui = true;
  alvo.ultima.cabeada.redes = [{ nome: 'Lab', download: 95, ping: 10, jitter: 2 }];
  const L = G.linhasDe(C.escolas), r = G.resumo(L);
  assert.strictEqual(r.p, r.pp + r.pr, 'aptas = aptas puras + aptas com ressalva');
  assert.strictEqual(r.pr, 1);
  const html = VG.viewProjetoG(C);
  assert.ok(html.includes('Apta com ressalva'));
  assert.ok(html.includes('Aptas com ressalva (1)'), 'falta o filtro da nova categoria');
  C.S.view = 'ficha'; C.S.ficha = alvo.chave;
  const f = VG.viewFicha(C);
  assert.ok(!f.includes('Próxima revistoria') && !f.includes('[Definir]'), 'responsável e revistoria saíram da ficha');
  assert.ok(f.includes('Apta com ressalva'));
});

test('1.5.2: Escolas com três seletores no lugar dos botões, abrindo pela vistoria mais recente', () => {
  const b = banco([mk({ escola: 'A', nota: 90, alunos: 100 }), mk({ escola: 'B', nota: 60, alunos: 50 })]);
  const C = contexto(b, estado({ view: 'projeto', projeto: 'P1', gAba: 'escolas' }));
  const html = VG.viewProjetoG(C);
  const ini = html.indexOf('<h3 class="gv-h3">Escolas</h3>'), fim = html.indexOf('gv-scroll', ini);
  const cab = html.slice(ini, fim);
  assert.ok(!cab.includes('gv-chip'), 'cabeçalho de Escolas sem botões');
  assert.deepStrictEqual((cab.match(/data-sel="(\w+)"/g) || []).map((x) => x.slice(10, -1)), ['gFiltro', 'gTipo', 'gOrdem']);
  ['Situação', 'Tipo de rede', 'Ordenar por', 'Todas (2)', 'Aptas (', 'Com ajustes (', 'Severas restrições (', 'Todas as redes (2)', 'Só Wi-Fi (', 'Híbridas, Wi-Fi e rede física (', 'Só rede física (', 'Última vistoria', 'Pior nota'].forEach((x) => assert.ok(cab.includes(x), 'falta ' + x));
  assert.ok(/<option value="recentes" selected>Última vistoria/.test(cab), 'abre ordenando pela vistoria mais recente');
  assert.ok(cab.includes('As vistorias mais recentes primeiro.'));
  C.S.gOrdem = 'nota'; C.S.gFiltro = 're';
  const cab2 = VG.viewProjetoG(C);
  assert.ok(/<option value="nota" selected>Pior nota/.test(cab2) && /<option value="re" selected>Com ajustes/.test(cab2));
  assert.strictEqual((cab2.match(/data-act="abrirFicha"/g) || []).length, 1);
});
